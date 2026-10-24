-- Mode Amis (LOT F3) : fonctions du salon de focus. Toutes SECURITY DEFINER avec
-- search_path fixé, toutes vérifient auth.uid() et is_banned() avant d'écrire.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

-- Entretien paresseux, appelé en tête de chaque fonction ci-dessous qui touche un salon
-- existant (jamais exposée directement au client) :
--  1. clôt naturellement un salon « running » dont le temps est écoulé ;
--  2. marque « abandoned » les participants « joined » silencieux depuis plus de 2
--     minutes (last_seen_at, mis à jour par get_room_state()) pendant que le salon
--     tourne ou est en pause ;
--  3. si l'hôte n'est plus « joined » (parti ou abandonné), transfère l'hôte au
--     participant « joined » le plus ancien, ou clôt le salon si plus personne n'y est.
-- Pas de job planifié nécessaire : suffisamment de monde interroge get_room_state() en
-- continu (minuteur partagé affiché) pour que ce nettoyage reste proche du temps réel.
create or replace function public._room_tick(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room_row public.rooms;
  next_host uuid;
begin
  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.status = 'ended' then
    return;
  end if;

  if room_row.status = 'running'
     and room_row.started_at is not null
     and room_row.duration_ms is not null
     and now() >= room_row.started_at + (room_row.duration_ms || ' milliseconds')::interval
  then
    update public.rooms set status = 'ended', ended_at = now() where id = p_room_id;
    room_row.status := 'ended';
  end if;

  if room_row.status in ('running', 'paused') then
    update public.room_participants rp
    set status = 'abandoned', left_at = now()
    where rp.room_id = p_room_id
      and rp.status = 'joined'
      and (rp.last_seen_at is null or rp.last_seen_at < now() - interval '2 minutes');
  end if;

  if room_row.status <> 'ended' and not exists (
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

-- Crée un salon et invite jusqu'à 5 amis (6 personnes au total, hôte compris — volontairement
-- restreint pour un premier lot). Chaque invité doit être ami avec l'hôte (are_friends()) ;
-- les doublons et l'hôte lui-même sont silencieusement ignorés dans la liste d'invités.
create or replace function public.create_room(p_focus_minutes integer, p_friend_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  new_room_id uuid;
  friend_id uuid;
  invite_count integer := 0;
begin
  if current_uid is null then
    raise exception 'create_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if p_focus_minutes is null or p_focus_minutes < 5 or p_focus_minutes > 120 then
    raise exception 'La durée doit être comprise entre 5 et 120 minutes';
  end if;

  insert into public.rooms (host_id, focus_minutes) values (current_uid, p_focus_minutes)
  returning id into new_room_id;

  insert into public.room_participants (room_id, user_id, role, status, joined_at, last_seen_at)
  values (new_room_id, current_uid, 'host', 'joined', now(), now());

  foreach friend_id in array coalesce(p_friend_ids, array[]::uuid[])
  loop
    if friend_id = current_uid then
      continue;
    end if;
    if exists (select 1 from public.room_participants where room_id = new_room_id and user_id = friend_id) then
      continue;
    end if;
    if not public.are_friends(current_uid, friend_id) then
      continue;
    end if;
    invite_count := invite_count + 1;
    if invite_count > 5 then
      raise exception 'Un salon réunit au plus 6 personnes (toi compris)';
    end if;
    insert into public.room_participants (room_id, user_id, role, status)
    values (new_room_id, friend_id, 'member', 'invited');
  end loop;

  return new_room_id;
end;
$$;

grant execute on function public.create_room(integer, uuid[]) to authenticated;
revoke execute on function public.create_room(integer, uuid[]) from anon;

-- Accepte ou refuse une invitation à un salon.
create or replace function public.respond_room_invite(p_room_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
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

  update public.room_participants
  set status = case when p_accept then 'joined' else 'declined' end,
      joined_at = case when p_accept then now() else joined_at end,
      last_seen_at = case when p_accept then now() else last_seen_at end
  where room_id = p_room_id and user_id = current_uid;
end;
$$;

grant execute on function public.respond_room_invite(uuid, boolean) to authenticated;
revoke execute on function public.respond_room_invite(uuid, boolean) from anon;

-- Démarre le minuteur partagé : réservé à l'hôte courant, salon encore en lobby.
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
  set status = 'running', started_at = now(), duration_ms = room_row.focus_minutes * 60000, elapsed_ms_at_pause = null
  where id = p_room_id;
end;
$$;

grant execute on function public.start_room(uuid) to authenticated;
revoke execute on function public.start_room(uuid) from anon;

-- Met le minuteur partagé en pause : réservé à l'hôte courant.
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

  elapsed := greatest(0, extract(epoch from (now() - room_row.started_at)) * 1000)::bigint;
  elapsed := least(elapsed, room_row.duration_ms);

  update public.rooms set status = 'paused', elapsed_ms_at_pause = elapsed where id = p_room_id;
end;
$$;

grant execute on function public.pause_room(uuid) to authenticated;
revoke execute on function public.pause_room(uuid) from anon;

-- Reprend le minuteur partagé après une pause : réservé à l'hôte courant.
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
  perform public._room_tick(p_room_id);

  select * into room_row from public.rooms where id = p_room_id;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut reprendre le salon';
  end if;
  if room_row.status <> 'paused' then
    raise exception 'Le salon n’est pas en pause';
  end if;

  update public.rooms
  set status = 'running',
      started_at = now() - (coalesce(room_row.elapsed_ms_at_pause, 0) || ' milliseconds')::interval,
      elapsed_ms_at_pause = null
  where id = p_room_id;
end;
$$;

grant execute on function public.resume_room(uuid) to authenticated;
revoke execute on function public.resume_room(uuid) from anon;

-- Termine le salon avant la fin naturelle : réservé à l'hôte courant.
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

  update public.rooms set status = 'ended', ended_at = now() where id = p_room_id;
end;
$$;

grant execute on function public.end_room(uuid) to authenticated;
revoke execute on function public.end_room(uuid) from anon;

-- Transfert explicite de l'hôte, à tout moment, vers un participant déjà « joined ».
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
  perform public._room_tick(p_room_id);

  select * into room_row from public.rooms where id = p_room_id;
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

grant execute on function public.transfer_host(uuid, uuid) to authenticated;
revoke execute on function public.transfer_host(uuid, uuid) from anon;

-- Quitte le salon volontairement. Si l'hôte part, _room_tick() (appelée juste après)
-- transfère aussitôt son rôle plutôt que d'attendre le délai d'abandon de 2 minutes.
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'leave_room() doit être appelé par un utilisateur authentifié';
  end if;

  update public.room_participants
  set status = 'left', left_at = now()
  where room_id = p_room_id and user_id = current_uid and status = 'joined';

  perform public._room_tick(p_room_id);
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;
revoke execute on function public.leave_room(uuid) from anon;

-- Mes salons (invitations en attente + salons actifs dont je fais partie), pour l'onglet
-- « Mes salons » du panneau. Exclut les salons terminés.
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
  created_at timestamptz
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
    r.created_at
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  join public.profiles hp on hp.id = r.host_id
  where rp.user_id = auth.uid()
    and rp.status in ('invited', 'joined')
    and r.status <> 'ended'
  order by r.created_at desc;
$$;

grant execute on function public.list_my_rooms() to authenticated;
revoke execute on function public.list_my_rooms() from anon;

-- État complet d'un salon (toujours appelée par un participant, quel que soit son statut)
-- — lue en continu pendant qu'un salon est ouvert à l'écran : sert donc aussi de
-- battement de cœur (met à jour mon propre last_seen_at) et déclenche l'entretien
-- paresseux (_room_tick) avant de répondre, pour renvoyer un état toujours à jour.
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

  update public.room_participants
  set last_seen_at = now()
  where room_id = p_room_id and user_id = current_uid and status in ('invited', 'joined');

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

grant execute on function public.get_room_state(uuid) to authenticated;
revoke execute on function public.get_room_state(uuid) from anon;

notify pgrst, 'reload schema';
