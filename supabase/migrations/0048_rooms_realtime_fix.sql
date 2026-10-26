-- LOT M1 (Mode Amis temps réel) — correctifs de fond, idempotents.
--
-- 1. RÉCURSION RLS : la politique SELECT de room_participants (0028) relisait sa propre
--    table (« infinite recursion detected in policy for relation room_participants »), et
--    celle de rooms en dépendait. Les lectures par RPC SECURITY DEFINER fonctionnaient,
--    mais Realtime évalue ces politiques pour chaque abonné : tous les évènements de
--    rooms / room_participants (création, invitation, démarrage, pause...) étaient
--    silencieusement perdus. Désormais : helper SECURITY DEFINER is_room_participant().
-- 2. live_status : la politique relisait profiles sous la RLS du lecteur (qui ne voit que
--    sa propre ligne) → jamais d'évènement pour les amis. Helper can_see_live_status().
-- 3. Un salon ne doit JAMAIS s'arrêter parce qu'un écran est fermé ou qu'un onglet est
--    suspendu : l'abandon automatique passe de 2 minutes à 3 heures de silence (« présent »
--    reste calculé sur 2 minutes, simple indicateur d'affichage), et touch_my_rooms()
--    permet un battement de cœur global, indépendant de l'écran du salon.
-- 4. REPLICA IDENTITY FULL : évènements UPDATE complets pour Realtime.

-- ─── 1. RLS rooms / room_participants ───────────────────────────────────────
create or replace function public.is_room_participant(p_room_id uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_uid is not null and exists (
    select 1 from public.room_participants rp
    where rp.room_id = p_room_id and rp.user_id = p_uid
  );
$$;

revoke all on function public.is_room_participant(uuid, uuid) from public, anon;
grant execute on function public.is_room_participant(uuid, uuid) to authenticated;

drop policy if exists "rooms_select_participant" on public.rooms;
create policy "rooms_select_participant" on public.rooms
  for select
  using (public.is_room_participant(id));

drop policy if exists "room_participants_select_participant" on public.room_participants;
create policy "room_participants_select_participant" on public.room_participants
  for select
  using (user_id = auth.uid() or public.is_room_participant(room_id));

-- ─── 2. RLS live_status ─────────────────────────────────────────────────────
create or replace function public.can_see_live_status(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    auth.uid() = p_owner
    or (
      public.are_friends(auth.uid(), p_owner)
      and exists (
        select 1 from public.profiles p
        where p.id = p_owner and p.show_live_status = true and p.invisible_mode = false
      )
    )
  );
$$;

revoke all on function public.can_see_live_status(uuid) from public, anon;
grant execute on function public.can_see_live_status(uuid) to authenticated;

drop policy if exists "live_status_select_self_or_friends" on public.live_status;
create policy "live_status_select_self_or_friends" on public.live_status
  for select
  using (public.can_see_live_status(user_id));

-- ─── 4. Realtime : lignes complètes ─────────────────────────────────────────
alter table public.rooms replica identity full;
alter table public.room_participants replica identity full;
alter table public.live_status replica identity full;

-- ─── 3. Entretien paresseux : tolérance au silence de 3 heures ──────────────
-- Corps de 0029 inchangé, sauf le seuil d'abandon (2 minutes → 3 heures).
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

  -- Abandon réel uniquement après 3 h de silence (appareil éteint, application supprimée) :
  -- un écran fermé, un onglet suspendu ou un iPad en veille ne font jamais quitter le salon.
  if room_row.status in ('running', 'paused') then
    update public.room_participants rp
    set status = 'abandoned', left_at = now()
    where rp.room_id = p_room_id
      and rp.status = 'joined'
      and (rp.last_seen_at is null or rp.last_seen_at < now() - interval '3 hours');
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

-- Battement de cœur global : met à jour ma présence dans TOUS mes salons non terminés
-- (invité ou rejoint), sans dépendre d'un écran de salon ouvert. Appelée par le client
-- toutes les ~30 s quand l'onglet est visible, et au retour au premier plan.
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
    perform public._room_tick(room_id_row);
  end loop;

  update public.room_participants rp
  set last_seen_at = now()
  from public.rooms r
  where r.id = rp.room_id
    and rp.user_id = current_uid
    and rp.status in ('invited', 'joined')
    and r.status <> 'ended';
end;
$$;

revoke all on function public.touch_my_rooms() from public, anon;
grant execute on function public.touch_my_rooms() to authenticated;

notify pgrst, 'reload schema';
