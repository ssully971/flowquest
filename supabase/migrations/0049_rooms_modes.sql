-- LOT M2 (Mode Amis) — le salon porte les 3 modes du minuteur : Pomodoro (cycles focus /
-- pause courte / pause longue), Chrono (compte vers le haut, sans durée) et Minuteur
-- (durée fixe, comportement historique des salons). Idempotente : recollable sans erreur.
--
-- Le temps reste TOUJOURS dérivé d'horodatages serveur (started_at de la phase courante,
-- elapsed_ms_at_pause en pause), jamais d'un compteur local : exact après suspension d'onglet.
--
--   rooms.mode, rooms.phase, rooms.phase_index : mode du salon, phase en cours (focus /
--     short_break / long_break ; toujours 'focus' pour Chrono et Minuteur) et son numéro
--     (0, 1, 2…). En Pomodoro, la phase suivante s'enchaîne d'elle-même sur le serveur
--     (_room_tick) à l'instant exact où la précédente se termine — started_at avance du
--     temps de la phase, sans dérive, même si personne n'était connecté à ce moment.
--   rooms.duration_ms : durée de la phase COURANTE (null en Chrono).
--
-- Enregistrement : chaque participant « joined » se voit créer des focus_sessions normales
-- (kind focus / short_break / long_break, temps réel passé dans la phase, pilier choisi) —
-- côté serveur, donc même onglet fermé ; le trigger existant (0034) recalcule l'XP du
-- pilier. Id déterministe (salon, phase, utilisateur) : jamais de doublon.

-- ─── Colonnes ───────────────────────────────────────────────────────────────
alter table public.rooms
  add column if not exists mode text not null default 'countdown',
  add column if not exists short_break_minutes integer,
  add column if not exists long_break_minutes integer,
  add column if not exists sessions_before_long_break integer,
  add column if not exists phase text not null default 'focus',
  add column if not exists phase_index integer not null default 0;

alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check check (mode in ('pomodoro', 'countdown', 'stopwatch'));
alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms add constraint rooms_phase_check check (phase in ('focus', 'short_break', 'long_break'));

-- Le Chrono n'a pas de durée : focus_minutes devient facultatif (5-120 pour les autres modes).
alter table public.rooms alter column focus_minutes drop not null;
alter table public.rooms drop constraint if exists rooms_focus_minutes_check;
alter table public.rooms drop constraint if exists rooms_mode_durations_check;
alter table public.rooms add constraint rooms_mode_durations_check check (
  (mode = 'stopwatch' and focus_minutes is null)
  or (mode <> 'stopwatch' and focus_minutes between 5 and 120)
);

alter table public.room_participants
  add column if not exists pillar_id uuid references public.pillars (id) on delete set null,
  add column if not exists phase_index_joined integer not null default 0,
  add column if not exists elapsed_ms_at_join bigint not null default 0;

-- ─── Fonctions pures ────────────────────────────────────────────────────────

-- Phase d'un numéro donné en Pomodoro : focus aux rangs pairs ; après le n-ième focus, pause
-- longue si n est un multiple de « sessions avant pause longue », sinon pause courte.
create or replace function public._room_phase_for_index(p_index integer, p_sessions_before_long integer)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_index % 2 = 0 then 'focus'
    when (((p_index - 1) / 2) + 1) % greatest(coalesce(p_sessions_before_long, 4), 1) = 0 then 'long_break'
    else 'short_break'
  end;
$$;

revoke all on function public._room_phase_for_index(integer, integer) from public, anon, authenticated;

create or replace function public._room_phase_duration_ms(p_room public.rooms, p_phase text)
returns bigint
language sql
immutable
set search_path = public
as $$
  select case p_room.mode
    when 'stopwatch' then null
    when 'countdown' then p_room.focus_minutes * 60000::bigint
    else case p_phase
      when 'focus' then p_room.focus_minutes * 60000::bigint
      when 'short_break' then coalesce(p_room.short_break_minutes, 5) * 60000::bigint
      else coalesce(p_room.long_break_minutes, 15) * 60000::bigint
    end
  end;
$$;

revoke all on function public._room_phase_duration_ms(public.rooms, text) from public, anon, authenticated;

-- Temps écoulé (ms) dans la phase courante à l'instant p_at.
create or replace function public._room_elapsed_ms(p_room public.rooms, p_at timestamptz)
returns bigint
language sql
immutable
set search_path = public
as $$
  select case
    when p_room.status = 'paused' then coalesce(p_room.elapsed_ms_at_pause, 0)
    when p_room.status = 'running' and p_room.started_at is not null
      then greatest(0, (extract(epoch from (p_at - p_room.started_at)) * 1000)::bigint)
    else 0
  end;
$$;

revoke all on function public._room_elapsed_ms(public.rooms, timestamptz) from public, anon, authenticated;

-- ─── Enregistrement des sessions de groupe ──────────────────────────────────

-- Une focus_session par participant et par phase (id déterministe : rejouable sans doublon).
-- Chrono et Minuteur sont du temps de focus réel : kind = 'focus'.
create or replace function public._room_record_session(
  p_room_id uuid,
  p_user_id uuid,
  p_kind text,
  p_phase_index integer,
  p_planned_ms bigint,
  p_actual_ms bigint,
  p_ended_at timestamptz,
  p_completed boolean,
  p_pillar_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actual_seconds integer := greatest(0, round(p_actual_ms / 1000.0))::integer;
begin
  if actual_seconds < 1 then
    return;
  end if;
  insert into public.focus_sessions (
    id, user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, completed, pillar_id
  ) values (
    md5(p_room_id::text || ':' || p_phase_index::text || ':' || p_user_id::text)::uuid,
    p_user_id,
    p_kind,
    greatest(coalesce(round(p_planned_ms / 1000.0)::integer, actual_seconds), 0),
    actual_seconds,
    p_ended_at - make_interval(secs => actual_seconds),
    p_ended_at,
    p_completed,
    case when p_kind = 'focus' then p_pillar_id else null end
  )
  on conflict (id) do nothing;
end;
$$;

revoke all on function public._room_record_session(uuid, uuid, text, integer, bigint, bigint, timestamptz, boolean, uuid) from public, anon, authenticated;

-- Enregistre la phase courante (ou terminée) du salon pour tous les « joined » : durée réelle
-- passée dans la phase, déduite de leur arrivée.
create or replace function public._room_record_phase(
  p_room public.rooms,
  p_ended_at timestamptz,
  p_elapsed_ms bigint,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  participant record;
  phase_kind text := p_room.phase;
  planned_ms bigint := public._room_phase_duration_ms(p_room, p_room.phase);
  actual_ms bigint;
begin
  for participant in
    select rp.user_id, rp.pillar_id, rp.phase_index_joined, rp.elapsed_ms_at_join
    from public.room_participants rp
    where rp.room_id = p_room.id and rp.status = 'joined'
  loop
    if participant.phase_index_joined > p_room.phase_index then
      continue;
    end if;
    actual_ms := p_elapsed_ms - case when participant.phase_index_joined = p_room.phase_index
      then participant.elapsed_ms_at_join else 0 end;
    perform public._room_record_session(
      p_room.id, participant.user_id, phase_kind, p_room.phase_index,
      planned_ms, greatest(actual_ms, 0), p_ended_at, p_completed, participant.pillar_id
    );
  end loop;
end;
$$;

revoke all on function public._room_record_phase(public.rooms, timestamptz, bigint, boolean) from public, anon, authenticated;

-- Clôt le salon en enregistrant la phase en cours pour tous les « joined ».
create or replace function public._room_close(p_room_id uuid, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room_row public.rooms;
begin
  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.status = 'ended' then
    return;
  end if;
  if room_row.status in ('running', 'paused') then
    perform public._room_record_phase(
      room_row, now(), public._room_elapsed_ms(room_row, now()), p_completed
    );
  end if;
  update public.rooms set status = 'ended', ended_at = now() where id = p_room_id;
end;
$$;

revoke all on function public._room_close(uuid, boolean) from public, anon, authenticated;

-- ─── Entretien paresseux : fin naturelle, enchaînement Pomodoro, abandon, hôte ──
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

  -- Phases terminées (en boucle : personne n'a peut-être interrogé le salon depuis plusieurs phases).
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

  -- Abandon réel uniquement après 3 h de silence (voir 0048).
  if room_row.status in ('running', 'paused') then
    update public.room_participants rp
    set status = 'abandoned', left_at = now()
    where rp.room_id = p_room_id
      and rp.status = 'joined'
      and (rp.last_seen_at is null or rp.last_seen_at < now() - interval '3 hours');
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

-- ─── Création / invitations ─────────────────────────────────────────────────
drop function if exists public.create_room(integer, uuid[]);

create or replace function public.create_room(
  p_focus_minutes integer,
  p_friend_ids uuid[],
  p_mode text default 'countdown',
  p_short_break_minutes integer default 5,
  p_long_break_minutes integer default 15,
  p_sessions_before_long_break integer default 4,
  p_pillar_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  new_room_id uuid;
  friend_id uuid;
  valid_friend_ids uuid[] := array[]::uuid[];
  room_focus integer := p_focus_minutes;
  room_short integer := null;
  room_long integer := null;
  room_sessions integer := null;
  room_duration bigint;
begin
  if current_uid is null then
    raise exception 'create_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if not public.is_feature_enabled('rooms') then
    raise exception 'Les salons de focus sont temporairement indisponibles';
  end if;
  if p_mode is null or p_mode not in ('pomodoro', 'countdown', 'stopwatch') then
    raise exception 'Mode de salon inconnu';
  end if;

  if p_mode = 'stopwatch' then
    room_focus := null;
  elsif p_focus_minutes is null or p_focus_minutes < 5 or p_focus_minutes > 120 then
    raise exception 'La durée doit être comprise entre 5 et 120 minutes';
  end if;

  if p_mode = 'pomodoro' then
    room_short := coalesce(p_short_break_minutes, 5);
    room_long := coalesce(p_long_break_minutes, 15);
    room_sessions := coalesce(p_sessions_before_long_break, 4);
    if room_short < 1 or room_short > 30 then
      raise exception 'La pause courte doit durer entre 1 et 30 minutes';
    end if;
    if room_long < 5 or room_long > 60 then
      raise exception 'La pause longue doit durer entre 5 et 60 minutes';
    end if;
    if room_sessions < 2 or room_sessions > 8 then
      raise exception 'Le nombre de sessions avant la pause longue doit être compris entre 2 et 8';
    end if;
  end if;

  if p_pillar_id is not null and not exists (
    select 1 from public.pillars where id = p_pillar_id and user_id = current_uid
  ) then
    p_pillar_id := null;
  end if;

  foreach friend_id in array coalesce(p_friend_ids, array[]::uuid[])
  loop
    if friend_id = current_uid or friend_id = any(valid_friend_ids) then
      continue;
    end if;
    if not public.are_friends(current_uid, friend_id) then
      continue;
    end if;
    valid_friend_ids := valid_friend_ids || friend_id;
  end loop;

  if array_length(valid_friend_ids, 1) is null then
    raise exception 'Invite au moins un ami pour créer un salon';
  end if;
  if array_length(valid_friend_ids, 1) > 5 then
    raise exception 'Un salon réunit au plus 6 personnes (toi compris)';
  end if;

  insert into public.rooms (
    host_id, focus_minutes, mode, short_break_minutes, long_break_minutes, sessions_before_long_break
  ) values (current_uid, room_focus, p_mode, room_short, room_long, room_sessions)
  returning id into new_room_id;

  insert into public.room_participants (room_id, user_id, role, status, joined_at, last_seen_at, pillar_id)
  values (new_room_id, current_uid, 'host', 'joined', now(), now(), p_pillar_id);

  foreach friend_id in array valid_friend_ids
  loop
    insert into public.room_participants (room_id, user_id, role, status)
    values (new_room_id, friend_id, 'member', 'invited');
  end loop;

  return new_room_id;
end;
$$;

revoke all on function public.create_room(integer, uuid[], text, integer, integer, integer, uuid) from public, anon;
grant execute on function public.create_room(integer, uuid[], text, integer, integer, integer, uuid) to authenticated;

drop function if exists public.respond_room_invite(uuid, boolean);

create or replace function public.respond_room_invite(
  p_room_id uuid,
  p_accept boolean,
  p_pillar_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
  valid_pillar uuid := null;
begin
  if current_uid is null then
    raise exception 'respond_room_invite() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;

  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_id and user_id = current_uid and status = 'invited'
  ) then
    raise exception 'Invitation introuvable';
  end if;

  if p_accept then
    perform public._room_tick(p_room_id);
    select * into room_row from public.rooms where id = p_room_id;
    if room_row.id is null or room_row.status = 'ended' then
      raise exception 'Ce salon est terminé';
    end if;
    if p_pillar_id is not null and exists (
      select 1 from public.pillars where id = p_pillar_id and user_id = current_uid
    ) then
      valid_pillar := p_pillar_id;
    end if;
  end if;

  update public.room_participants rp
  set status = case when p_accept then 'joined' else 'declined' end,
      joined_at = case when p_accept then now() else rp.joined_at end,
      last_seen_at = case when p_accept then now() else rp.last_seen_at end,
      pillar_id = case when p_accept then valid_pillar else rp.pillar_id end,
      phase_index_joined = case when p_accept then room_row.phase_index else rp.phase_index_joined end,
      elapsed_ms_at_join = case when p_accept then public._room_elapsed_ms(room_row, now()) else rp.elapsed_ms_at_join end
  where rp.room_id = p_room_id and rp.user_id = current_uid;
end;
$$;

revoke all on function public.respond_room_invite(uuid, boolean, uuid) from public, anon;
grant execute on function public.respond_room_invite(uuid, boolean, uuid) to authenticated;

-- Pilier rattaché à mes sessions de ce salon (modifiable à tout moment, effet sur la phase
-- en cours et les suivantes). Un pilier qui n'est pas le mien est ignoré.
create or replace function public.set_room_pillar(p_room_id uuid, p_pillar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'set_room_pillar() doit être appelé par un utilisateur authentifié';
  end if;
  if p_pillar_id is not null and not exists (
    select 1 from public.pillars where id = p_pillar_id and user_id = current_uid
  ) then
    p_pillar_id := null;
  end if;
  update public.room_participants rp
  set pillar_id = p_pillar_id
  where rp.room_id = p_room_id and rp.user_id = current_uid and rp.status in ('invited', 'joined');
end;
$$;

revoke all on function public.set_room_pillar(uuid, uuid) from public, anon;
grant execute on function public.set_room_pillar(uuid, uuid) to authenticated;

-- ─── Contrôles de l'hôte ────────────────────────────────────────────────────
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
  perform public._room_tick(p_room_id);

  select * into room_row from public.rooms where id = p_room_id;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut démarrer le salon';
  end if;
  if room_row.status <> 'lobby' then
    raise exception 'Le salon a déjà démarré';
  end if;

  update public.rooms
  set status = 'running',
      started_at = now(),
      phase = 'focus',
      phase_index = 0,
      duration_ms = public._room_phase_duration_ms(room_row, 'focus'),
      elapsed_ms_at_pause = null
  where id = p_room_id;

  -- Tous ceux déjà présents dans le lobby participent dès la première seconde.
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
  perform public._room_tick(p_room_id);

  select * into room_row from public.rooms where id = p_room_id;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut mettre le salon en pause';
  end if;
  if room_row.status <> 'running' then
    raise exception 'Le salon n’est pas en cours';
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
  perform public._room_tick(p_room_id);

  select * into room_row from public.rooms where id = p_room_id;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut terminer le salon';
  end if;
  if room_row.status = 'ended' then
    return;
  end if;

  perform public._room_close(p_room_id, false);
end;
$$;

revoke all on function public.end_room(uuid) from public, anon;
grant execute on function public.end_room(uuid) to authenticated;

-- Quitter : mes minutes de la phase en cours sont enregistrées, puis je pars.
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

  perform public._room_tick(p_room_id);
  select * into room_row from public.rooms where id = p_room_id;
  select * into me from public.room_participants
  where room_id = p_room_id and user_id = current_uid and status = 'joined';

  if me.user_id is not null and room_row.status in ('running', 'paused')
     and me.phase_index_joined <= room_row.phase_index then
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

  perform public._room_tick(p_room_id);
end;
$$;

revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;

-- ─── Lectures ───────────────────────────────────────────────────────────────
drop function if exists public.list_my_rooms();

create or replace function public.list_my_rooms()
returns table (
  room_id uuid,
  host_id uuid,
  host_username text,
  host_display_name text,
  status text,
  focus_minutes integer,
  my_status text,
  participant_count integer,
  created_at timestamptz,
  mode text,
  phase text,
  started_at timestamptz,
  duration_ms bigint,
  elapsed_ms_at_pause bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.host_id, hp.username, hp.display_name, r.status, r.focus_minutes,
    rp.status,
    (select count(*) from public.room_participants rp2 where rp2.room_id = r.id and rp2.status = 'joined')::integer,
    r.created_at, r.mode, r.phase, r.started_at, r.duration_ms, r.elapsed_ms_at_pause
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  join public.profiles hp on hp.id = r.host_id
  where rp.user_id = auth.uid()
    and rp.status in ('invited', 'joined')
    and r.status <> 'ended'
  order by r.created_at desc;
$$;

revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;

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
  server_now timestamptz
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

  update public.room_participants rp
  set last_seen_at = now()
  where rp.room_id = p_room_id and rp.user_id = current_uid and rp.status in ('invited', 'joined');

  return query
  select
    r.id, r.host_id, r.status, r.focus_minutes, r.started_at, r.duration_ms,
    r.elapsed_ms_at_pause, r.created_at, r.ended_at,
    rp.user_id, p.username, p.display_name, p.avatar_url, p.avatar_version,
    rp.role, rp.status,
    (rp.last_seen_at is not null and rp.last_seen_at >= now() - interval '2 minutes'),
    r.mode, r.phase, r.phase_index, r.short_break_minutes, r.long_break_minutes,
    r.sessions_before_long_break, now()
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
