-- LOT 5 — test manuel de la migration 0053 (invite_to_room). À exécuter dans l'éditeur SQL Supabase après
-- 0053_invite_to_room.sql ; une seule transaction annulée à la fin (ROLLBACK).
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
    mail, extensions.crypt('i-test', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
$$;

do $$
declare
  hst uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  f1 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  f2 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
  f3 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
  f4 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a14';
  f5 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a15';
  f6 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a16';
  stranger uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a20';
  banned_friend uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21';
  r uuid; r2 uuid;
  n integer; st text; joined_idx integer;
  ids uuid[] := array[f1, f2, f3, f4, f5, f6, stranger, banned_friend];
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(hst, 'i-host@example.com');
  perform pg_temp.new_user(f1, 'i-f1@example.com');
  perform pg_temp.new_user(f2, 'i-f2@example.com');
  perform pg_temp.new_user(f3, 'i-f3@example.com');
  perform pg_temp.new_user(f4, 'i-f4@example.com');
  perform pg_temp.new_user(f5, 'i-f5@example.com');
  perform pg_temp.new_user(f6, 'i-f6@example.com');
  perform pg_temp.new_user(stranger, 'i-stranger@example.com');
  perform pg_temp.new_user(banned_friend, 'i-banned@example.com');
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  insert into public.friendships (requester_id, addressee_id, status)
  select hst, x, 'accepted' from unnest(array[f1, f2, f3, f4, f5, f6, banned_friend]) as x;
  update public.profiles set banned_at = now() where id = banned_friend;

  perform pg_temp.as_user(hst);
  r := public.create_room(25, array[f1]);
  perform pg_temp.as_user(f1);
  perform public.respond_room_invite(r, true);
  perform pg_temp.as_user(hst);
  perform public.start_room(r);

  raise notice '--- 1. L''hôte invite un ami après coup ---';
  n := public.invite_to_room(r, array[f2]);
  if n <> 1 then raise exception 'Une invitation attendue, reçu %', n; end if;
  select status into st from public.room_participants where room_id = r and user_id = f2;
  if st <> 'invited' then raise exception 'f2 devrait être invité, statut %', st; end if;

  raise notice '--- 2. Idempotent : déjà invité ou déjà présent = ignoré, sans erreur ---';
  if public.invite_to_room(r, array[f2]) <> 0 then raise exception 'Réinviter f2 ne doit rien créer'; end if;
  if public.invite_to_room(r, array[f1, hst]) <> 0 then raise exception 'Inviter un présent / soi-même ne doit rien créer'; end if;

  raise notice '--- 3. Seuls les amis non bannis sont invités ---';
  if public.invite_to_room(r, array[stranger, banned_friend]) <> 0 then
    raise exception 'Un non-ami et un ami banni doivent être ignorés';
  end if;
  select count(*) into n from public.room_participants where room_id = r and user_id in (stranger, banned_friend);
  if n <> 0 then raise exception 'Aucune ligne ne devait être créée pour eux'; end if;

  raise notice '--- 4. Réservé à l''hôte ---';
  perform pg_temp.as_user(f1);
  begin perform public.invite_to_room(r, array[f3]); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;
  perform pg_temp.as_user(stranger);
  begin perform public.invite_to_room(r, array[f3]); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;

  raise notice '--- 5. L''invité qui accepte rejoint en cours de route, horloge depuis started_at ---';
  update public.rooms set started_at = started_at - interval '10 minutes' where id = r;
  perform pg_temp.as_user(f2);
  perform public.respond_room_invite(r, true);
  select rp.status, rp.phase_index_joined into st, joined_idx
  from public.room_participants rp where rp.room_id = r and rp.user_id = f2;
  if st <> 'joined' then raise exception 'f2 aurait dû rejoindre, statut %', st; end if;
  select count(*) into n from public.get_room_state(r) where participant_user_id = f2 and participant_status = 'joined';
  if n <> 1 then raise exception 'f2 doit apparaître dans l''état du salon'; end if;

  raise notice '--- 6. Plafond de 6 personnes (hôte compris), atomique ---';
  perform pg_temp.as_user(hst);
  -- Actuellement : hôte + f1 + f2 = 3. On peut en ajouter 3 (f3, f4, f5), pas f6 en plus.
  begin perform public.invite_to_room(r, array[f3, f4, f5, f6]); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;
  select count(*) into n from public.room_participants where room_id = r and user_id in (f3, f4, f5, f6);
  if n <> 0 then raise exception 'Refus atomique : aucune invitation ne devait être créée, reçu %', n; end if;
  if public.invite_to_room(r, array[f3, f4, f5]) <> 3 then raise exception 'Trois invitations attendues'; end if;

  raise notice '--- 7. Un ami qui a refusé peut être réinvité ---';
  perform pg_temp.as_user(f3);
  perform public.respond_room_invite(r, false);
  perform pg_temp.as_user(hst);
  if public.invite_to_room(r, array[f3]) <> 1 then raise exception 'f3 (refusé) doit pouvoir être réinvité'; end if;
  select status into st from public.room_participants where room_id = r and user_id = f3;
  if st <> 'invited' then raise exception 'f3 devrait de nouveau être invité'; end if;

  raise notice '--- 8. Salon terminé : refus clair ---';
  perform public.end_room(r);
  begin perform public.invite_to_room(r, array[f6]); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;

  raise notice '--- 9. Salon en attente (lobby) : l''hôte peut aussi inviter ---';
  r2 := public.create_room(25, array[f1]);
  if public.invite_to_room(r2, array[f6]) <> 1 then raise exception 'Invitation en lobby attendue'; end if;

  raise notice 'OK — migration 0053 : invite_to_room.';
end;
$$;

rollback;
