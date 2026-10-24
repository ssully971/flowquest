-- Mode Amis (LOT F4) : série partagée entre deux amis. Un jour compte pour la paire dès
-- que CHACUN des deux a complété au moins une session de focus ce jour-là (`completed =
-- true` — définition volontairement différente de la série personnelle, qui exige
-- d'atteindre l'objectif quotidien choisi : deux amis n'ont pas forcément le même
-- objectif, « une vraie session chacun » est le plus petit dénominateur commun qui reste
-- parlant à deux). Jour calculé dans le fuseau America/Guadeloupe (même référence que
-- weekly_leaderboard(), LOT F2) : fuseau commun, pas celui — potentiellement différent —
-- de chacun des deux comptes.
--
-- Entretenue par un trigger sur focus_sessions (s'incrémente au moment où une session
-- devient complétée, en vérifiant si l'ami l'est déjà ce jour-là) plutôt que recalculée à
-- chaque lecture sur tout l'historique (coûteux à la longue, et longest_streak doit
-- survivre à une remise à zéro de la série actuelle — une agrégation pure comme
-- weekly_leaderboard() ne conviendrait pas ici). La remise à zéro en cas de jour manqué
-- reste paresseuse, faite à la lecture (list_duo_streaks(), migration 0032) plutôt que
-- par un job planifié.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.duo_streaks (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint duo_streaks_order check (user_low < user_high)
);

alter table public.duo_streaks enable row level security;

drop policy if exists "duo_streaks_select_own_pair" on public.duo_streaks;
create policy "duo_streaks_select_own_pair" on public.duo_streaks
  for select
  using (auth.uid() in (user_low, user_high));

grant select on public.duo_streaks to authenticated;
revoke all on public.duo_streaks from anon;

-- Aucune politique INSERT/UPDATE/DELETE : entretenue exclusivement par le trigger
-- ci-dessous (SECURITY DEFINER) et par le reset paresseux de list_duo_streaks()
-- (migration 0032), jamais une écriture directe depuis le client.

create or replace function public.bump_duo_streaks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date;
  partner record;
  pair_low uuid;
  pair_high uuid;
  existing public.duo_streaks;
  new_current integer;
begin
  -- Ne réagit qu'au moment précis où une session de focus devient complétée (jamais aux
  -- pauses, jamais aux mises à jour ultérieures d'une session déjà complétée) : évite de
  -- retraiter la même journée à chaque modification non pertinente de la ligne.
  if NEW.kind <> 'focus' or NEW.completed is not true then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.completed is true then
    return NEW;
  end if;

  today := (NEW.started_at at time zone 'America/Guadeloupe')::date;

  for partner in
    select (case when f.requester_id = NEW.user_id then f.addressee_id else f.requester_id end) as id
    from public.friendships f
    where f.status = 'accepted' and (f.requester_id = NEW.user_id or f.addressee_id = NEW.user_id)
  loop
    if public.is_banned(partner.id) or public.is_banned(NEW.user_id) then
      continue;
    end if;

    -- L'ami a-t-il, lui aussi, complété une session de focus ce même jour ?
    if not exists (
      select 1 from public.focus_sessions s
      where s.user_id = partner.id and s.kind = 'focus' and s.completed = true
        and (s.started_at at time zone 'America/Guadeloupe')::date = today
    ) then
      continue;
    end if;

    pair_low := least(NEW.user_id, partner.id);
    pair_high := greatest(NEW.user_id, partner.id);

    select * into existing from public.duo_streaks where user_low = pair_low and user_high = pair_high for update;

    if existing.user_low is null then
      insert into public.duo_streaks (user_low, user_high, current_streak, longest_streak, last_active_date)
      values (pair_low, pair_high, 1, 1, today);
    elsif existing.last_active_date = today then
      -- Déjà compté aujourd'hui (l'un des deux avait déjà complété une session avant
      -- celle-ci) : rien à refaire.
      null;
    else
      new_current := case when existing.last_active_date = today - 1 then existing.current_streak + 1 else 1 end;
      update public.duo_streaks
      set current_streak = new_current,
          longest_streak = greatest(existing.longest_streak, new_current),
          last_active_date = today,
          updated_at = now()
      where user_low = pair_low and user_high = pair_high;
    end if;
  end loop;

  return NEW;
end;
$$;

revoke execute on function public.bump_duo_streaks() from public, anon, authenticated;

drop trigger if exists bump_duo_streaks_on_focus_session on public.focus_sessions;
create trigger bump_duo_streaks_on_focus_session
  after insert or update on public.focus_sessions
  for each row execute function public.bump_duo_streaks();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duo_streaks'
  ) then
    execute 'alter publication supabase_realtime add table public.duo_streaks';
  end if;
end;
$$;

notify pgrst, 'reload schema';
