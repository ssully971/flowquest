-- LOT H1 : corrige « column reference "room_id" is ambiguous » dans get_room_state()
-- (migration 0029). Cause : `returns table (room_id uuid, ..., status text, ...)` déclare
-- implicitement `room_id`/`status` comme des variables PL/pgSQL dans tout le corps de la
-- fonction ; l'UPDATE sur room_participants plus bas les référence SANS alias de table,
-- donc Postgres ne sait plus s'il s'agit de la colonne de la table ou de la variable de
-- sortie (plpgsql.variable_conflict vaut 'error' par défaut — jamais résolu au hasard).
--
-- AUDIT : toutes les fonctions plpgsql à RETURNS TABLE ou paramètres OUT de
-- supabase/migrations ont été relues à la recherche du même défaut (identifiant nu, dans
-- une clause WHERE/SET/ORDER BY, qui coïncide avec un nom de colonne de sortie) :
--   - find_profile_preview (0022), list_friends ×2 (0022/0025), list_friend_requests
--     (0022), list_unread_cheers (0026), list_my_rooms (0029) : SELECT entièrement
--     qualifiés (alias de table), ou `language sql` (pas de espace de variables séparé
--     de PL/pgSQL — le bug ne peut pas s'y produire) → rien à corriger.
--   - get_room_state (0029) : même défaut que ci-dessus, sur `room_id`/`status` → corrigé.
--   - list_duo_streaks (0032) : même défaut, sur `current_streak`/`last_active_date` dans
--     l'UPDATE de remise à zéro paresseuse → corrigé.
--   - weekly_leaderboard (0027) : `order by leaderboard_rank, p.username` référence nue
--     un alias de sortie qui coïncide avec un paramètre OUT — corrigé par prudence (une
--     référence positionnelle lève l'ambiguïté sans changer le résultat).
--
-- Mêmes signatures de retour partout : CREATE OR REPLACE suffit, pas besoin de DROP
-- FUNCTION (les GRANT existants sont conservés automatiquement).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.get_room_state(p_room_id uuid)
returns table (
  room_id uuid,
  host_id uuid,
  status text,
  focus_minutes integer,
  started_at timestamptz,
  duration_ms bigint,
  elapsed_ms_at_pause bigint,
  created_at timestamptz,
  ended_at timestamptz,
  participant_user_id uuid,
  participant_username text,
  participant_display_name text,
  participant_avatar_url text,
  participant_avatar_version integer,
  participant_role text,
  participant_status text,
  participant_is_present boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'get_room_state() doit être appelé par un utilisateur authentifié';
  end if;
  if not exists (
    select 1 from public.room_participants rp where rp.room_id = p_room_id and rp.user_id = current_uid
  ) then
    raise exception 'Salon introuvable';
  end if;

  perform public._room_tick(p_room_id);

  -- Alias obligatoire (rp.room_id/rp.user_id/rp.status) : sans lui, ces trois noms nus
  -- sont ambigus avec les colonnes de sortie room_id/status ci-dessus (voir audit).
  update public.room_participants rp
  set last_seen_at = now()
  where rp.room_id = p_room_id and rp.user_id = current_uid and rp.status in ('invited', 'joined');

  return query
  select
    r.id, r.host_id, r.status, r.focus_minutes, r.started_at, r.duration_ms,
    r.elapsed_ms_at_pause, r.created_at, r.ended_at,
    rp.user_id, p.username, p.display_name, p.avatar_url, p.avatar_version,
    rp.role, rp.status,
    (rp.last_seen_at is not null and rp.last_seen_at >= now() - interval '2 minutes')
  from public.rooms r
  join public.room_participants rp on rp.room_id = r.id
  join public.profiles p on p.id = rp.user_id
  where r.id = p_room_id
    and not public.is_banned(rp.user_id)
  order by (rp.role = 'host') desc, rp.joined_at asc nulls last, rp.created_at asc;
end;
$$;

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

  -- Alias obligatoire (ds.current_streak/ds.last_active_date) : sans lui, ces deux noms
  -- nus sont ambigus avec les colonnes de sortie current_streak/last_active_date
  -- ci-dessus (voir audit en tête de fichier). user_low/user_high ne collisionnent avec
  -- aucune colonne de sortie, mais alignés ici pour rester cohérent et lisible.
  update public.duo_streaks ds
  set current_streak = 0, updated_at = now()
  where (ds.user_low = current_uid or ds.user_high = current_uid)
    and ds.current_streak > 0
    and ds.last_active_date < today - 1;

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

create or replace function public.weekly_leaderboard(p_week_offset integer default 0)
returns table (
  leaderboard_rank integer,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_version integer,
  is_self boolean,
  score integer,
  focus_seconds bigint,
  completion_rate integer,
  regularity_rate integer,
  week_start timestamptz,
  week_end timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  local_now timestamp;
  week_start_local timestamp;
  week_start_utc timestamptz;
  week_end_utc timestamptz;
begin
  if current_uid is null then
    raise exception 'weekly_leaderboard() doit être appelé par un utilisateur authentifié';
  end if;
  if p_week_offset not in (0, 1) then
    raise exception 'p_week_offset doit être 0 (semaine en cours) ou 1 (semaine précédente)';
  end if;

  local_now := (now() at time zone 'America/Guadeloupe');
  week_start_local := date_trunc('week', local_now) - (p_week_offset || ' weeks')::interval;
  week_start_utc := week_start_local at time zone 'America/Guadeloupe';
  week_end_utc := (week_start_local + interval '7 days') at time zone 'America/Guadeloupe';

  return query
  with eligible as (
    select current_uid as uid, true as self
    union
    select p.id, false
    from public.friendships f
    join public.profiles p
      on p.id = (case when f.requester_id = current_uid then f.addressee_id else f.requester_id end)
    where f.status = 'accepted'
      and (f.requester_id = current_uid or f.addressee_id = current_uid)
      and p.participate_leaderboard = true
      and p.invisible_mode = false
      and not public.is_banned(p.id)
  ),
  agg as (
    select
      e.uid,
      e.self,
      count(s.*) filter (where s.kind = 'focus') as total_started,
      count(s.*) filter (where s.kind = 'focus' and s.completed) as total_completed,
      coalesce(sum(s.actual_seconds) filter (where s.kind = 'focus'), 0) as focus_seconds,
      count(distinct date_trunc('day', s.started_at at time zone 'America/Guadeloupe'))
        filter (where s.kind = 'focus') as active_days
    from eligible e
    left join public.focus_sessions s
      on s.user_id = e.uid and s.started_at >= week_start_utc and s.started_at < week_end_utc
    group by e.uid, e.self
  ),
  scored as (
    select
      agg.uid,
      agg.self,
      agg.focus_seconds,
      case when agg.total_started = 0 then 0
        else round((agg.total_completed::numeric / agg.total_started) * 100)
      end as completion_rate,
      round(least(agg.active_days, 7) / 7.0 * 100) as regularity_rate,
      case when agg.total_started = 0 then 0
        else round(
          (agg.total_completed::numeric / agg.total_started)
          * (0.7 + 0.3 * (least(agg.active_days, 7) / 7.0))
          * 100
        )
      end as score
    from agg
  )
  select
    rank() over (order by scored.score desc, scored.focus_seconds desc)::integer as leaderboard_rank,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_version,
    scored.self as is_self,
    scored.score::integer,
    scored.focus_seconds,
    scored.completion_rate::integer,
    scored.regularity_rate::integer,
    week_start_utc as week_start,
    week_end_utc as week_end
  from scored
  join public.profiles p on p.id = scored.uid
  -- Référence positionnelle (1 = leaderboard_rank, 3 = username) plutôt que le nom
  -- d'alias nu : « order by leaderboard_rank » coïncide avec le paramètre de sortie du
  -- même nom (voir audit en tête de fichier) — par prudence, jamais vérifié en pratique
  -- sur ce cas précis, mais le même risque que get_room_state()/list_duo_streaks().
  order by 1, 3;
end;
$$;

notify pgrst, 'reload schema';
