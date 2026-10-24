-- Mode Amis (LOT F4) : lecture de la série partagée avec chaque ami. Reset paresseux
-- avant lecture (même principe que _room_tick(), LOT F3) : toute paire dont la dernière
-- journée commune date de plus d'un jour voit sa série actuelle remise à zéro — jamais
-- stocké comme « expiré » quelque part, recalculé à chaque appel plutôt qu'avec un job
-- planifié.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.list_duo_streaks()
returns table (
  friend_id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_version integer,
  current_streak integer,
  longest_streak integer,
  last_active_date date,
  active_today boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  today date := (now() at time zone 'America/Guadeloupe')::date;
begin
  if current_uid is null then
    raise exception 'list_duo_streaks() doit être appelé par un utilisateur authentifié';
  end if;

  update public.duo_streaks
  set current_streak = 0, updated_at = now()
  where (user_low = current_uid or user_high = current_uid)
    and current_streak > 0
    and last_active_date < today - 1;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_version,
    coalesce(ds.current_streak, 0),
    coalesce(ds.longest_streak, 0),
    ds.last_active_date,
    coalesce(ds.last_active_date = today, false)
  from public.friendships f
  join public.profiles p
    on p.id = (case when f.requester_id = current_uid then f.addressee_id else f.requester_id end)
  left join public.duo_streaks ds
    on ds.user_low = least(current_uid, p.id) and ds.user_high = greatest(current_uid, p.id)
  where f.status = 'accepted'
    and (f.requester_id = current_uid or f.addressee_id = current_uid)
    and not public.is_banned(p.id)
  order by coalesce(ds.current_streak, 0) desc, p.username asc;
end;
$$;

grant execute on function public.list_duo_streaks() to authenticated;
revoke execute on function public.list_duo_streaks() from anon;

notify pgrst, 'reload schema';
