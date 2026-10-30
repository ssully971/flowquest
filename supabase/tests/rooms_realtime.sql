-- LOT M1 — test manuel des correctifs temps réel du Mode Amis (migration 0048), à exécuter
-- dans l'éditeur SQL Supabase après 0048_rooms_realtime_fix.sql. Une seule transaction
-- annulée à la fin (ROLLBACK). Vérifie surtout ce que Realtime évalue : les politiques RLS
-- en lecture DIRECTE, en tant que rôle `authenticated` (avant 0048 : « infinite recursion
-- detected in policy for relation room_participants »).

begin;

create or replace function pg_temp.as_user(uid uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create or replace function pg_temp.new_user(uid uuid, mail text)
returns void language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, extensions.crypt('m1-test', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
$$;

do $$
declare
  host_id uuid := 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  guest_id uuid := 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
  stranger_id uuid := 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
  new_room uuid;
  n integer;
  host_now uuid;
begin
  raise notice '--- 0. Comptes de test (bêta coupée le temps de la création) ---';
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(host_id, 'm1-host@example.com');
  perform pg_temp.new_user(guest_id, 'm1-guest@example.com');
  perform pg_temp.new_user(stranger_id, 'm1-stranger@example.com');
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  insert into public.friendships (requester_id, addressee_id, status) values (host_id, guest_id, 'accepted');

  raise notice '--- 1. Création d''un salon (RPC) ---';
  perform pg_temp.as_user(host_id);
  new_room := public.create_room(25, array[guest_id]);

  raise notice '--- 2. Lecture DIRECTE en tant que participant (ce que voit Realtime) ---';
  set local role authenticated;
  perform pg_temp.as_user(guest_id);
  select count(*) into n from public.room_participants where room_id = new_room;
  if n <> 2 then raise exception 'L''invité devrait voir les 2 lignes de participants, reçu %', n; end if;
  select count(*) into n from public.rooms where id = new_room;
  if n <> 1 then raise exception 'L''invité devrait voir le salon, reçu %', n; end if;

  raise notice '--- 3. Un étranger ne voit ni le salon ni ses participants ---';
  perform pg_temp.as_user(stranger_id);
  select count(*) into n from public.room_participants where room_id = new_room;
  if n <> 0 then raise exception 'Fuite : un étranger voit % participants', n; end if;
  select count(*) into n from public.rooms;
  if n <> 0 then raise exception 'Fuite : un étranger voit % salons', n; end if;
  reset role;

  raise notice '--- 4. Statut en direct : visible par un ami, pas par un étranger ---';
  insert into public.live_status (user_id, state) values (host_id, 'focus');
  set local role authenticated;
  perform pg_temp.as_user(guest_id);
  select count(*) into n from public.live_status where user_id = host_id;
  if n <> 1 then raise exception 'Un ami devrait voir le statut en direct, reçu %', n; end if;
  perform pg_temp.as_user(stranger_id);
  select count(*) into n from public.live_status where user_id = host_id;
  if n <> 0 then raise exception 'Un étranger ne doit pas voir le statut en direct'; end if;
  reset role;

  raise notice '--- 5. Un silence de 10 minutes ne fait PAS quitter le salon ---';
  perform pg_temp.as_user(guest_id);
  perform public.respond_room_invite(new_room, true);
  perform pg_temp.as_user(host_id);
  perform public.start_room(new_room);
  update public.room_participants set last_seen_at = now() - interval '10 minutes' where room_id = new_room;
  -- Un tiers qui interroge le salon déclenche l'entretien : personne ne doit être « abandoned ».
  perform pg_temp.as_user(guest_id);
  perform count(*) from public.get_room_state(new_room);
  select count(*) into n from public.room_participants where room_id = new_room and status = 'joined';
  if n <> 2 then raise exception 'Après 10 min de silence, les 2 participants doivent rester joined, reçu %', n; end if;
  select r.host_id into host_now from public.rooms r where r.id = new_room;
  if host_now <> host_id then raise exception 'L''hôte ne doit pas avoir changé'; end if;
  if (select status from public.rooms where id = new_room) <> 'running' then
    raise exception 'Le salon doit toujours tourner';
  end if;

  raise notice '--- 6. touch_my_rooms() : battement de cœur global ---';
  perform pg_temp.as_user(host_id);
  perform public.touch_my_rooms();
  -- Depuis 0050 le battement s'écrit dans room_heartbeats (hors Realtime), plus dans room_participants.
  if coalesce((select last_seen_at from public.room_heartbeats where room_id = new_room and user_id = host_id), '-infinity') < now() - interval '1 minute' then
    raise exception 'touch_my_rooms() devrait rafraîchir room_heartbeats';
  end if;

  raise notice '--- 7. Au bout de 3 h de silence, l''abandon automatique reste possible ---';
  update public.room_participants set last_seen_at = now() - interval '4 hours' where room_id = new_room and user_id = guest_id;
  perform pg_temp.as_user(host_id);
  perform count(*) from public.get_room_state(new_room);
  if (select status from public.room_participants where room_id = new_room and user_id = guest_id) <> 'abandoned' then
    raise exception 'L''invité silencieux depuis 4 h devrait être abandoned';
  end if;

  raise notice '=== TOUT EST PASSÉ : temps réel du Mode Amis OK ===';
end;
$$;

rollback;
