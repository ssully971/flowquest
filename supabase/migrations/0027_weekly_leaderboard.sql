-- Mode Amis (LOT F2) : classement hebdomadaire (§3). Moi + mes amis ayant choisi d'y
-- figurer (participate_leaderboard, et pas en mode invisible), score de focus = taux
-- d'achèvement × (0,7 + 0,3 × régularité sur les 7 jours de la semaine) — formule
-- distincte de computeFocusScore() côté client (src/features/stats/compute-stats.ts, un
-- simple produit achèvement × régularité) : voir docs/AMIS.md pour la justification de
-- cet écart assumé entre le score personnel (Stats) et le score de classement (Amis).
-- Semaine du lundi au dimanche, fuseau America/Guadeloupe (§3, explicitement demandé).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

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
  order by leaderboard_rank, p.username;
end;
$$;

grant execute on function public.weekly_leaderboard(integer) to authenticated;
revoke execute on function public.weekly_leaderboard(integer) from anon;

notify pgrst, 'reload schema';
