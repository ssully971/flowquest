-- LOT P1 (Mode Amis, performance) — fin de la boucle d'écriture des salons. Idempotente :
-- recollable sans erreur.
--
-- DIAGNOSTIC : get_room_state() (0049) était une LECTURE qui écrivait (UPDATE room_participants
-- SET last_seen_at) et prenait un SELECT … FOR UPDATE sur la ligne du salon via _room_tick() à
-- chaque appel. Or room_participants est publiée dans Realtime et chaque client relit l'état à
-- chaque évènement : chaque lecture produisait un évènement qui déclenchait des relectures chez
-- tous les clients… une boucle sans fin, qui saturait la base (requêtes lentes, « network error »).
--
-- 1. get_room_state devient réellement en LECTURE SEULE : plus aucun UPDATE ; _room_tick (qui
--    verrouille la ligne) n'est appelé que si une transition est due, vérifiée SANS verrou par
--    _room_tick_due() (fin de phase, hôte absent, participant muet depuis plus de 3 h).
-- 2. Le battement de cœur quitte les tables publiées dans Realtime : table room_heartbeats
--    (NON publiée), alimentée par touch_my_rooms() — upsert seulement si la dernière valeur a
--    plus de 60 s. _room_tick (abandon après 3 h de silence, tolérance de 0048 conservée) et
--    participant_is_present la lisent. Les last_seen_at existants sont migrés.
-- 3. REPLICA IDENTITY FULL (0048) retirée sur rooms et room_participants : le client ne lit
--    jamais l'ancienne ligne d'un évènement (il recharge l'état via get_room_state) et les
--    filtres Realtime (id=eq., room_id=eq.) s'évaluent sur la NOUVELLE ligne. Moins de WAL.
--    (live_status garde FULL : hors périmètre.)
-- 4. Actions idempotentes : un double clic (start, pause, resume, end, leave, transfer_host)
--    ne lève plus jamais d'erreur ; l'état est verrouillé (FOR UPDATE) le temps de l'action.
-- 5. get_room_state renvoie aussi room_updated_at (version du salon) : le client ignore les
--    évènements Realtime dont la version est déjà connue.

-- ─── 1. Table des battements de cœur (hors publication Realtime) ────────────
create table if not exists public.room_heartbeats (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_heartbeats enable row level security;
-- Aucune politique : accès uniquement par les fonctions SECURITY DEFINER ci-dessous.
revoke all on table public.room_heartbeats from public, anon, authenticated;

-- Garde-fou : jamais dans la publication Realtime (sinon la boucle reviendrait).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_heartbeats'
  ) then
    execute 'alter publication supabase_realtime drop table public.room_heartbeats';
  end if;
end $$;

-- Migration des présences existantes (sans écraser un battement déjà plus récent).
insert into public.room_heartbeats (room_id, user_id, last_seen_at)
select rp.room_id, rp.user_id, rp.last_seen_at
from public.room_participants rp
where rp.last_seen_at is not null
on conflict (room_id, user_id) do nothing;

-- ─── 2. Realtime : retour à l'identité de réplication par défaut ────────────
alter table public.rooms replica identity default;
alter table public.room_participants replica identity default;

-- ─── 3. Dernière présence connue (jointure participants / battements) ───────
create or replace function public._room_last_seen(p_room_id uuid, p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    (select rp.last_seen_at from public.room_participants rp where rp.room_id = p_room_id and rp.user_id = p_user_id),
    (select hb.last_seen_at from public.room_heartbeats hb where hb.room_id = p_room_id and hb.user_id = p_user_id)
  );
$$;

revoke all on function public._room_last_seen(uuid, uuid) from public, anon, authenticated;

-- Vrai si une transition est due (fin de phase, hôte absent, abandon à 3 h) : lecture SANS
-- verrou, pour que get_room_state ne prenne jamais FOR UPDATE quand il n'y a rien à faire.
create or replace function public._room_tick_due(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select r.status <> 'ended' and (
      (r.status = 'running' and r.started_at is not null and r.duration_ms is not null
        and now() >= r.started_at + (r.duration_ms || ' milliseconds')::interval)
      or not exists (
        select 1 from public.room_participants h
        where h.room_id = r.id and h.user_id = r.host_id and h.status = 'joined'
      )
      or (r.status in ('running', 'paused') and exists (
        select 1 from public.room_participants rp
        where rp.room_id = r.id and rp.status = 'joined'
          and coalesce(public._room_last_seen(rp.room_id, rp.user_id), '-infinity'::timestamptz)
            < now() - interval '3 hours'
      ))
    )
    from public.rooms r where r.id = p_room_id
  ), false);
$$;

revoke all on function public._room_tick_due(uuid) from public, anon, authenticated;

-- Entretien paresseux : corps de 0049, seul l'abandon lit désormais room_heartbeats.
create or replace function public._room_tick(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room_row public.rooms;
  phase_end timestamptz;
  next_index integer;
  next_phase text;
  next_host uuid;
  guard integer := 0;
begin
  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.status = 'ended' then
    return;
  end if;

  while room_row.status = 'running'
        and room_row.started_at is not null
        and room_row.duration_ms is not null
        and now() >= room_row.started_at + (room_row.duration_ms || ' milliseconds')::interval
        and guard < 500
  loop
    guard := guard + 1;
    phase_end := room_row.started_at + (room_row.duration_ms || ' milliseconds')::interval;

    perform public._room_record_phase(room_row, phase_end, room_row.duration_ms, true);

    if room_row.mode = 'pomodoro' then
      next_index := room_row.phase_index + 1;
      next_phase := public._room_phase_for_index(next_index, room_row.sessions_before_long_break);
      update public.rooms
      set phase_index = next_index,
          phase = next_phase,
          started_at = phase_end,
          duration_ms = public._room_phase_duration_ms(room_row, next_phase),
          elapsed_ms_at_pause = null
      where id = p_room_id;
      select * into room_row from public.rooms where id = p_room_id;
    else
      update public.rooms set status = 'ended', ended_at = phase_end where id = p_room_id;
      select * into room_row from public.rooms where id = p_room_id;
    end if;
  end loop;

  if room_row.status = 'ended' then
    return;
  end if;

  -- Abandon réel uniquement après 3 h de silence (voir 0048) : dernière présence = la plus
  -- récente entre room_participants.last_seen_at (arrivée) et room_heartbeats (battements).
  if room_row.status in ('running', 'paused') then
    update public.room_participants rp
    set status = 'abandoned', left_at = now()
    where rp.room_id = p_room_id
      and rp.status = 'joined'
      and coalesce(public._room_last_seen(rp.room_id, rp.user_id), '-infinity'::timestamptz)
        < now() - interval '3 hours';
  end if;

  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_id and user_id = room_row.host_id and status = 'joined'
  ) then
    select user_id into next_host
    from public.room_participants
    where room_id = p_room_id and status = 'joined'
    order by joined_at asc
    limit 1;

    if next_host is not null then
      update public.rooms set host_id = next_host where id = p_room_id;
      update public.room_participants set role = 'member'
        where room_id = p_room_id and user_id = room_row.host_id;
      update public.room_participants set role = 'host'
        where room_id = p_room_id and user_id = next_host;
    else
      update public.rooms set status = 'ended', ended_at = now() where id = p_room_id;
    end if;
  end if;
end;
$$;

revoke execute on function public._room_tick(uuid) from public, anon, authenticated;

-- ─── 4. Battement de cœur : table dédiée, jamais room_participants ──────────
-- Appelée par le client ~toutes les 2 min (onglet visible) : sert uniquement de filet
-- d'abandon (3 h). Aucune écriture si le dernier battement a moins de 60 s.
create or replace function public.touch_my_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_id_row uuid;
begin
  if current_uid is null then
    raise exception 'touch_my_rooms() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    return;
  end if;

  for room_id_row in
    select rp.room_id
    from public.room_participants rp
    join public.rooms r on r.id = rp.room_id
    where rp.user_id = current_uid
      and rp.status in ('invited', 'joined')
      and r.status <> 'ended'
  loop
    if public._room_tick_due(room_id_row) then
      perform public._room_tick(room_id_row);
    end if;

    insert into public.room_heartbeats (room_id, user_id, last_seen_at)
    values (room_id_row, current_uid, now())
    on conflict (room_id, user_id) do update
      set last_seen_at = now()
      where public.room_heartbeats.last_seen_at < now() - interval '60 seconds';
  end loop;
end;
$$;

revoke all on function public.touch_my_rooms() from public, anon;
grant execute on function public.touch_my_rooms() to authenticated;

-- ─── 5. Actions idempotentes (verrou FOR UPDATE le temps de l'action) ───────
create or replace function public.start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
begin
  if current_uid is null then
    raise exception 'start_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;

  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut démarrer le salon';
  end if;
  -- Déjà démarré (double clic) ou terminé : rien à faire, jamais d'erreur.
  if room_row.status <> 'lobby' then
    return;
  end if;

  update public.rooms
  set status = 'running',
      started_at = now(),
      phase = 'focus',
      phase_index = 0,
      duration_ms = public._room_phase_duration_ms(room_row, 'focus'),
      elapsed_ms_at_pause = null
  where id = p_room_id;

  update public.room_participants set phase_index_joined = 0, elapsed_ms_at_join = 0
  where room_id = p_room_id and status = 'joined';
end;
$$;

revoke all on function public.start_room(uuid) from public, anon;
grant execute on function public.start_room(uuid) to authenticated;

create or replace function public.pause_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
  elapsed bigint;
begin
  if current_uid is null then
    raise exception 'pause_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;

  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut mettre le salon en pause';
  end if;
  -- Déjà en pause, pas démarré ou terminé : rien à faire.
  if room_row.status <> 'running' then
    return;
  end if;

  elapsed := public._room_elapsed_ms(room_row, now());
  if room_row.duration_ms is not null then
    elapsed := least(elapsed, room_row.duration_ms);
  end if;

  update public.rooms set status = 'paused', elapsed_ms_at_pause = elapsed where id = p_room_id;
end;
$$;

revoke all on function public.pause_room(uuid) from public, anon;
grant execute on function public.pause_room(uuid) to authenticated;

create or replace function public.resume_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
begin
  if current_uid is null then
    raise exception 'resume_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;

  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut reprendre le salon';
  end if;
  -- Déjà repris, pas en pause ou terminé : rien à faire.
  if room_row.status <> 'paused' then
    return;
  end if;

  update public.rooms
  set status = 'running',
      started_at = now() - (coalesce(room_row.elapsed_ms_at_pause, 0) || ' milliseconds')::interval,
      elapsed_ms_at_pause = null
  where id = p_room_id;
end;
$$;

revoke all on function public.resume_room(uuid) from public, anon;
grant execute on function public.resume_room(uuid) to authenticated;

create or replace function public.end_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
begin
  if current_uid is null then
    raise exception 'end_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;

  select * into room_row from public.rooms where id = p_room_id for update;
  -- Déjà terminé (double clic, fin naturelle entre-temps) : succès silencieux pour un participant.
  if room_row.status = 'ended' and public.is_room_participant(p_room_id, current_uid) then
    return;
  end if;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut terminer le salon';
  end if;

  perform public._room_close(p_room_id, false);
end;
$$;

revoke all on function public.end_room(uuid) from public, anon;
grant execute on function public.end_room(uuid) to authenticated;

create or replace function public.transfer_host(p_room_id uuid, p_new_host_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
begin
  if current_uid is null then
    raise exception 'transfer_host() doit être appelé par un utilisateur authentifié';
  end if;
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;

  select * into room_row from public.rooms where id = p_room_id for update;
  -- Transfert déjà effectué (double clic) ou salon terminé : rien à faire.
  if room_row.id is not null and (room_row.host_id = p_new_host_id or room_row.status = 'ended')
     and public.is_room_participant(p_room_id, current_uid) then
    return;
  end if;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut transférer son rôle';
  end if;
  if p_new_host_id = current_uid then
    return;
  end if;
  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_id and user_id = p_new_host_id and status = 'joined'
  ) then
    raise exception 'Cette personne n’est pas dans le salon';
  end if;

  update public.rooms set host_id = p_new_host_id where id = p_room_id;
  update public.room_participants set role = 'member' where room_id = p_room_id and user_id = current_uid;
  update public.room_participants set role = 'host' where room_id = p_room_id and user_id = p_new_host_id;
end;
$$;

revoke all on function public.transfer_host(uuid, uuid) from public, anon;
grant execute on function public.transfer_host(uuid, uuid) to authenticated;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
  me public.room_participants;
begin
  if current_uid is null then
    raise exception 'leave_room() doit être appelé par un utilisateur authentifié';
  end if;

  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  select * into me from public.room_participants
  where room_id = p_room_id and user_id = current_uid and status = 'joined';

  -- Déjà parti (double clic) : aucune ligne à modifier, aucune erreur.
  if me.user_id is null then
    return;
  end if;

  if room_row.status in ('running', 'paused') and me.phase_index_joined <= room_row.phase_index then
    perform public._room_record_session(
      p_room_id, current_uid, room_row.phase, room_row.phase_index,
      public._room_phase_duration_ms(room_row, room_row.phase),
      greatest(0, public._room_elapsed_ms(room_row, now())
        - case when me.phase_index_joined = room_row.phase_index then me.elapsed_ms_at_join else 0 end),
      now(), false, me.pillar_id
    );
  end if;

  update public.room_participants
  set status = 'left', left_at = now()
  where room_id = p_room_id and user_id = current_uid and status = 'joined';

  -- Si l'hôte part : transfert immédiat de son rôle (ou fin du salon s'il est vide).
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;
end;
$$;

revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;

-- ─── 6. get_room_state : LECTURE SEULE ──────────────────────────────────────
drop function if exists public.get_room_state(uuid);

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
  participant_is_present boolean,
  mode text,
  phase text,
  phase_index integer,
  short_break_minutes integer,
  long_break_minutes integer,
  sessions_before_long_break integer,
  server_now timestamptz,
  room_updated_at timestamptz
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

  -- Entretien SEULEMENT si une transition est due (vérifié sans verrou) : la lecture
  -- ordinaire n'écrit rien et ne prend aucun verrou de ligne.
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;

  return query
  select
    r.id, r.host_id, r.status, r.focus_minutes, r.started_at, r.duration_ms,
    r.elapsed_ms_at_pause, r.created_at, r.ended_at,
    rp.user_id, p.username, p.display_name, p.avatar_url, p.avatar_version,
    rp.role, rp.status,
    -- Indicateur de secours (le client affiche Supabase Presence) : battement de moins de 5 min.
    (coalesce(public._room_last_seen(rp.room_id, rp.user_id), '-infinity'::timestamptz)
      >= now() - interval '5 minutes'),
    r.mode, r.phase, r.phase_index, r.short_break_minutes, r.long_break_minutes,
    r.sessions_before_long_break, now(), r.updated_at
  from public.rooms r
  join public.room_participants rp on rp.room_id = r.id
  join public.profiles p on p.id = rp.user_id
  where r.id = p_room_id
    and not public.is_banned(rp.user_id)
  order by (rp.role = 'host') desc, rp.joined_at asc nulls last, rp.created_at asc;
end;
$$;

revoke all on function public.get_room_state(uuid) from public, anon;
grant execute on function public.get_room_state(uuid) to authenticated;

notify pgrst, 'reload schema';
