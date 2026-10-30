-- LOT P1 — test manuel de la migration 0050 (salons : fin de la boucle d'écriture). À exécuter
-- dans l'éditeur SQL Supabase après 0050_rooms_performance.sql ; une seule transaction
-- annulée à la fin (ROLLBACK). Prouve surtout que get_room_state() NE MODIFIE AUCUNE LIGNE :
-- compteurs de tuples modifiés de la transaction (pg_stat_get_xact_tuples_*) et ctid des lignes
-- (un UPDATE crée une nouvelle version de ligne, donc un nouveau ctid) comparés avant / après.
-- (xmin ne convient pas ici : les lignes créées dans la même transaction ont déjà ce xmin.)

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
    mail, extensions.crypt('p1-test', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
$$;

-- Nombre cumulé de lignes modifiées / insérées dans la transaction pour une table.
create or replace function pg_temp.writes(tbl regclass)
returns bigint language sql as $$
  select coalesce(pg_stat_get_xact_tuples_updated(tbl), 0)
       + coalesce(pg_stat_get_xact_tuples_inserted(tbl), 0)
       + coalesce(pg_stat_get_xact_tuples_deleted(tbl), 0);
$$;

-- Empreinte des positions physiques des lignes d'un salon (change dès qu'une ligne est réécrite).
create or replace function pg_temp.fingerprint(p_room uuid)
returns text language sql as $$
  select coalesce((select string_agg(ctid::text, ',' order by user_id) from public.room_participants where room_id = p_room), '')
      || '|' || coalesce((select ctid::text from public.rooms where id = p_room), '')
      || '|' || coalesce((select string_agg(ctid::text, ',' order by user_id) from public.room_heartbeats where room_id = p_room), '');
$$;

do $$
declare
  hst uuid := 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  gst uuid := 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
  r1 uuid; r2 uuid; r3 uuid;
  before_rooms bigint; before_parts bigint; before_hb bigint;
  fp_before text;
  seen_1 timestamptz; seen_2 timestamptz;
  n integer; st text; host_now uuid;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(hst, 'p1-host@example.com');
  perform pg_temp.new_user(gst, 'p1-guest@example.com');
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  insert into public.friendships (requester_id, addressee_id, status) values (hst, gst, 'accepted');

  perform pg_temp.as_user(hst);
  r1 := public.create_room(25, array[gst]);
  perform pg_temp.as_user(gst);
  perform public.respond_room_invite(r1, true);
  perform pg_temp.as_user(hst);
  perform public.start_room(r1);

  raise notice '--- 1. get_room_state ne modifie AUCUNE ligne (ni salon, ni participants, ni battements) ---';
  before_rooms := pg_temp.writes('public.rooms');
  before_parts := pg_temp.writes('public.room_participants');
  before_hb := pg_temp.writes('public.room_heartbeats');
  fp_before := pg_temp.fingerprint(r1);
  for i in 1..5 loop
    perform pg_temp.as_user(hst);
    perform * from public.get_room_state(r1);
    perform pg_temp.as_user(gst);
    perform * from public.get_room_state(r1);
  end loop;
  if pg_temp.writes('public.rooms') <> before_rooms then raise exception 'get_room_state a écrit dans rooms'; end if;
  if pg_temp.writes('public.room_participants') <> before_parts then raise exception 'get_room_state a écrit dans room_participants'; end if;
  if pg_temp.writes('public.room_heartbeats') <> before_hb then raise exception 'get_room_state a écrit dans room_heartbeats'; end if;
  if pg_temp.fingerprint(r1) <> fp_before then raise exception 'get_room_state a réécrit une ligne (ctid modifié)'; end if;
  if public._room_tick_due(r1) then raise exception 'Aucune transition ne devrait être due'; end if;

  raise notice '--- 2. Battement de cœur : room_heartbeats seulement, throttle de 60 s ---';
  before_parts := pg_temp.writes('public.room_participants');
  perform pg_temp.as_user(gst);
  perform public.touch_my_rooms();
  select last_seen_at into seen_1 from public.room_heartbeats where room_id = r1 and user_id = gst;
  if seen_1 is null then raise exception 'Le battement doit créer une ligne room_heartbeats'; end if;
  perform public.touch_my_rooms();
  select last_seen_at into seen_2 from public.room_heartbeats where room_id = r1 and user_id = gst;
  if seen_2 <> seen_1 then raise exception 'Deux battements à moins de 60 s ne doivent écrire qu''une fois'; end if;
  if pg_temp.writes('public.room_participants') <> before_parts then raise exception 'touch_my_rooms ne doit plus écrire dans room_participants'; end if;
  update public.room_heartbeats set last_seen_at = now() - interval '2 minutes' where room_id = r1 and user_id = gst;
  perform public.touch_my_rooms();
  select last_seen_at into seen_2 from public.room_heartbeats where room_id = r1 and user_id = gst;
  if seen_2 < now() - interval '5 seconds' then raise exception 'Un battement de plus de 60 s doit être rafraîchi'; end if;

  raise notice '--- 3. Hors publication Realtime, identité de réplication par défaut ---';
  select count(*) into n from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_heartbeats';
  if n <> 0 then raise exception 'room_heartbeats ne doit PAS être publiée dans Realtime'; end if;
  select count(*) into n from pg_class
    where oid in ('public.rooms'::regclass, 'public.room_participants'::regclass) and relreplident <> 'd';
  if n <> 0 then raise exception 'REPLICA IDENTITY doit être DEFAULT sur rooms et room_participants'; end if;

  raise notice '--- 4. Actions idempotentes : le double clic ne lève jamais d''erreur ---';
  perform pg_temp.as_user(hst);
  perform public.start_room(r1);           -- déjà démarré
  perform public.pause_room(r1);
  perform public.pause_room(r1);           -- déjà en pause
  perform public.resume_room(r1);
  perform public.resume_room(r1);          -- déjà repris
  perform public.transfer_host(r1, gst);
  perform public.transfer_host(r1, gst);   -- déjà transféré
  select host_id into host_now from public.rooms where id = r1;
  if host_now <> gst then raise exception 'L''hôte aurait dû passer à l''invité'; end if;
  perform pg_temp.as_user(gst);
  perform public.end_room(r1);
  perform public.end_room(r1);             -- déjà terminé
  perform pg_temp.as_user(hst);
  perform public.end_room(r1);             -- un participant non hôte, salon terminé : silencieux
  perform public.leave_room(r1);
  perform public.leave_room(r1);           -- déjà parti

  raise notice '--- 5. Fin naturelle : get_room_state déclenche la transition due ---';
  perform pg_temp.as_user(hst);
  r2 := public.create_room(25, array[gst]);
  perform pg_temp.as_user(gst);
  perform public.respond_room_invite(r2, true);
  perform pg_temp.as_user(hst);
  perform public.start_room(r2);
  update public.rooms set started_at = started_at - interval '30 minutes' where id = r2;
  if not public._room_tick_due(r2) then raise exception 'La fin de phase devrait être due'; end if;
  perform * from public.get_room_state(r2);
  select status into st from public.rooms where id = r2;
  if st <> 'ended' then raise exception 'Le salon aurait dû se terminer, statut %', st; end if;

  raise notice '--- 6. Abandon après 3 h de silence (battements lus dans room_heartbeats) ---';
  perform pg_temp.as_user(hst);
  r3 := public.create_room(25, array[gst]);
  perform pg_temp.as_user(gst);
  perform public.respond_room_invite(r3, true);
  perform pg_temp.as_user(hst);
  perform public.start_room(r3);
  perform pg_temp.as_user(gst);
  perform public.touch_my_rooms();
  update public.room_participants set last_seen_at = now() - interval '4 hours' where room_id = r3 and user_id = gst;
  update public.room_heartbeats set last_seen_at = now() - interval '2 hours' where room_id = r3 and user_id = gst;
  if public._room_tick_due(r3) then raise exception '2 h de silence ne doivent PAS faire abandonner (tolérance 3 h)'; end if;
  update public.room_heartbeats set last_seen_at = now() - interval '4 hours' where room_id = r3 and user_id = gst;
  if not public._room_tick_due(r3) then raise exception '4 h de silence devraient être dues'; end if;
  perform pg_temp.as_user(hst);
  perform * from public.get_room_state(r3);
  select rp.status into st from public.room_participants rp where rp.room_id = r3 and rp.user_id = gst;
  if st <> 'abandoned' then raise exception 'L''invité muet depuis 4 h aurait dû être abandonné, statut %', st; end if;

  raise notice 'OK — migration 0050 : lecture seule, battements hors Realtime, actions idempotentes.';
end;
$$;

rollback;
