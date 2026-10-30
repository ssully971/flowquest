-- LOT T (Minuteur) — temps de pause et pauses manuelles des sessions, plafond de durée. Idempotente :
-- recollable sans erreur dans l'éditeur SQL Supabase.
--
-- 1. focus_sessions.paused_seconds / pause_count : alimentent le récapitulatif de fin de session
--    (temps de pause total, nombre de pauses manuelles). Colonnes facultatives (défaut 0) : les
--    sessions existantes et les anciens clients ne sont pas affectés.
-- 2. Garde-fou léger anti-oubli : à l'ÉCRITURE d'une session, actual_seconds est plafonné au temps
--    réellement écoulé entre started_at et ended_at (on ne peut pas avoir « travaillé » plus que la
--    durée réelle de la session) et à 24 h. Le client applique déjà la règle des 4 h de focus
--    (confirmation « Tu es toujours là ? », voir src/features/timer/engine) ; ce plafond ne fait que
--    couper les valeurs absurdes d'un client ancien ou trafiqué. L'historique existant n'est jamais
--    réécrit (le déclencheur ne s'applique qu'aux nouvelles écritures).

alter table public.focus_sessions
  add column if not exists paused_seconds integer not null default 0,
  add column if not exists pause_count integer not null default 0;

alter table public.focus_sessions drop constraint if exists focus_sessions_pause_check;
alter table public.focus_sessions
  add constraint focus_sessions_pause_check check (paused_seconds >= 0 and pause_count >= 0) not valid;

create or replace function public.clamp_focus_session_seconds()
returns trigger
language plpgsql
as $$
declare
  wall_seconds numeric;
begin
  new.paused_seconds := greatest(coalesce(new.paused_seconds, 0), 0);
  new.pause_count := greatest(coalesce(new.pause_count, 0), 0);
  if new.ended_at is not null and new.started_at is not null then
    wall_seconds := extract(epoch from (new.ended_at - new.started_at));
    if wall_seconds >= 0 then
      new.actual_seconds := least(new.actual_seconds, ceil(wall_seconds)::integer);
    end if;
  end if;
  new.actual_seconds := least(new.actual_seconds, 86400);
  return new;
end;
$$;

drop trigger if exists focus_sessions_clamp_seconds on public.focus_sessions;
create trigger focus_sessions_clamp_seconds
  before insert or update of actual_seconds, started_at, ended_at on public.focus_sessions
  for each row execute function public.clamp_focus_session_seconds();

notify pgrst, 'reload schema';
