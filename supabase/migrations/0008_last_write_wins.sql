-- Résolution de conflit "dernier horodatage gagne" pour user_settings et timer_state :
-- si un appareil hors ligne envoie une écriture plus ancienne qu'un changement déjà en
-- base (fait depuis un autre appareil entre-temps), elle est silencieusement ignorée au
-- lieu d'écraser l'état le plus récent. focus_sessions n'a pas ce trigger : chaque session
-- a un id unique généré côté client, donc il n'y a jamais d'écrasement entre deux sessions
-- différentes ("jamais de perte" — voir docs/SECURITE.md).
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.reject_stale_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists user_settings_reject_stale_write on public.user_settings;
create trigger user_settings_reject_stale_write
  before update on public.user_settings
  for each row execute function public.reject_stale_write();

drop trigger if exists timer_state_reject_stale_write on public.timer_state;
create trigger timer_state_reject_stale_write
  before update on public.timer_state
  for each row execute function public.reject_stale_write();
