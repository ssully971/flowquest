-- Profil détaillé « god mode » (LOT I3, §3) : vue en lecture seule des STATISTIQUES
-- uniquement d'un utilisateur (temps de focus, heatmap, répartition des piliers,
-- dernières activités) — jamais le contenu de ses tâches, notes ou messages, qui ne sont
-- interrogés nulle part dans cette fonction. Chaque ouverture est journalisée (§12),
-- l'admin_log servant lui-même de preuve d'accès pour un éventuel audit RGPD.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.admin_user_stats(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_focus_seconds bigint;
  daily_focus jsonb;
  pillar_breakdown jsonb;
  recent_activity jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_user_stats() réservé aux administrateurs';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'Compte introuvable';
  end if;

  -- Journalisé avant même de construire la réponse : un admin qui consulte ces
  -- statistiques en laisse systématiquement la trace, qu'il exploite ou non le résultat.
  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'view_user_stats', p_target_user_id::text);

  select coalesce(sum(actual_seconds), 0)
  into total_focus_seconds
  from public.focus_sessions
  where user_id = p_target_user_id and kind = 'focus';

  -- Heatmap personnelle : même forme (dayStart en ms, focusSeconds, sessionsCount) que
  -- DayFocus (src/features/stats/compute-stats.ts), consommée par le même composant
  -- FocusCalendar côté interface — un an glissant, un jour sans session reste à 0.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'dayStart', (extract(epoch from d) * 1000)::bigint,
      'focusSeconds', coalesce(fs.seconds, 0),
      'sessionsCount', coalesce(fs.sessions_count, 0)
    )
    order by d
  ), '[]'::jsonb)
  into daily_focus
  from generate_series(current_date - interval '364 days', current_date, interval '1 day') as d
  left join (
    select date_trunc('day', started_at) as day,
           sum(actual_seconds) as seconds,
           count(*) as sessions_count
    from public.focus_sessions
    where user_id = p_target_user_id and kind = 'focus'
    group by 1
  ) fs on fs.day = d;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', p.name,
      'level', p.level,
      'focusSeconds', coalesce(fs.seconds, 0)
    )
    order by coalesce(fs.seconds, 0) desc
  ), '[]'::jsonb)
  into pillar_breakdown
  from public.pillars p
  left join (
    select pillar_id, sum(actual_seconds) as seconds
    from public.focus_sessions
    where user_id = p_target_user_id and kind = 'focus' and pillar_id is not null
    group by pillar_id
  ) fs on fs.pillar_id = p.id
  where p.user_id = p_target_user_id and p.archived_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'startedAt', fs.started_at,
      'kind', fs.kind,
      'actualSeconds', fs.actual_seconds,
      'pillarName', p.name
    )
    order by fs.started_at desc
  ), '[]'::jsonb)
  into recent_activity
  from (
    select started_at, kind, actual_seconds, pillar_id
    from public.focus_sessions
    where user_id = p_target_user_id
    order by started_at desc
    limit 20
  ) fs
  left join public.pillars p on p.id = fs.pillar_id;

  return jsonb_build_object(
    'totalFocusSeconds', total_focus_seconds,
    'dailyFocus', daily_focus,
    'pillars', pillar_breakdown,
    'recentActivity', recent_activity
  );
end;
$$;

grant execute on function public.admin_user_stats(uuid) to authenticated;
revoke execute on function public.admin_user_stats(uuid) from anon;

notify pgrst, 'reload schema';
