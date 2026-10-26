-- BÊTA FERMÉE — test manuel des codes d'invitation, à exécuter TOI-MÊME dans l'éditeur SQL
-- Supabase (ou via psql) après avoir collé 0047_invite_codes.sql. Même modèle que
-- h1_room_and_social_rpc.sql : crée de vrais comptes de test dans auth.users (déclenche
-- handle_new_user() comme une vraie inscription), tourne dans UNE SEULE transaction
-- annulée à la fin (ROLLBACK) — rien ne persiste, relançable à volonté.
--
-- Couvre : code valide, déjà utilisé, expiré, absent, création de compte qui échoue (le
-- code n'est pas brûlé), compte Google en attente puis activé, interrupteur beta_fermee,
-- limite mensuelle, ancienneté, focus insuffisant, droits (aucune écriture directe),
-- limitation de débit de check_invite_code.
--
-- Limite d'un test mono-transaction : « deux consommations simultanées » est vérifié ici
-- de façon séquentielle (la seconde échoue). Pour la vraie concurrence, ouvre DEUX
-- sessions SQL, lance dans chacune `begin; select public._consume_invite_code('CODE',
-- gen_random_uuid());` sans valider : la seconde reste bloquée jusqu'au COMMIT de la
-- première, puis renvoie false.

begin;

-- Exécute une instruction et vérifie qu'elle échoue avec un message contenant `expected`.
create or replace function pg_temp.expect_error(stmt text, expected text)
returns void
language plpgsql
as $$
begin
  execute stmt;
  raise exception 'ATTENDU une erreur contenant "%" mais aucune erreur : %', expected, stmt;
exception when others then
  if sqlerrm like 'ATTENDU%' then raise; end if;
  if position(expected in sqlerrm) = 0 then
    raise exception 'Erreur inattendue pour % : "%" (attendu "%")', stmt, sqlerrm, expected;
  end if;
end;
$$;

create or replace function pg_temp.as_user(uid uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create or replace function pg_temp.as_postgres()
returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;

create or replace function pg_temp.new_user(uid uuid, mail text, provider text, meta jsonb default '{}'::jsonb)
returns void language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, extensions.crypt('invite-test', extensions.gen_salt('bf')), now(),
    now(), now(), json_build_object('provider', provider, 'providers', array[provider])::jsonb,
    meta, false, '', '', '', ''
  );
$$;

do $$
declare
  adm_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  alice_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
  bob_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
  carol_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04';
  goog_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05';
  late_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06';
  open_id uuid := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07';
  admin_code text;
  admin_exp timestamptz;
  user_code text;
  second_code text;
  elig record;
  ok boolean;
  n integer;
begin
  raise notice '--- 0. Mise en place : un admin (compte créé AVANT la bêta, flag coupé) ---';
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(adm_id, 'inv-admin@example.com', 'email');
  update public.profiles set role = 'admin' where id = adm_id;
  update public.feature_flags set enabled = true where key = 'beta_fermee';

  raise notice '--- 1. admin_generate_invite_code() ---';
  perform pg_temp.as_user(alice_id);
  perform pg_temp.expect_error('select * from public.admin_generate_invite_code()', 'réservé aux administrateurs');
  perform pg_temp.as_user(adm_id);
  select code, expires_at into admin_code, admin_exp from public.admin_generate_invite_code();
  if admin_code !~ '^[A-HJKMNP-Z2-9]{8}$' then
    raise exception 'Format de code inattendu : %', admin_code;
  end if;
  if admin_exp < now() + interval '11 hours 59 minutes' or admin_exp > now() + interval '12 hours 1 minute' then
    raise exception 'Expiration admin attendue ~12 h, reçu %', admin_exp;
  end if;
  if not exists (select 1 from public.admin_log where admin_id = adm_id and action = 'invite.generate') then
    raise exception 'Génération non journalisée dans admin_log';
  end if;
  raise notice 'OK : code % valide jusqu''à %', admin_code, admin_exp;

  raise notice '--- 2. check_invite_code() : valide / inexistant / insensible à la casse ---';
  perform pg_temp.as_postgres();
  if not public.check_invite_code(lower(' ' || admin_code || ' ')) then
    raise exception 'check_invite_code() devrait accepter le code (casse/espaces ignorés)';
  end if;
  if public.check_invite_code('ZZZZZZZZ') then
    raise exception 'check_invite_code() ne doit pas accepter un code inexistant';
  end if;
  raise notice 'OK';

  raise notice '--- 3. Inscription e-mail SANS code / avec mauvais code : refusée ---';
  perform pg_temp.expect_error(
    format('select pg_temp.new_user(%L, ''inv-x@example.com'', ''email'')', alice_id), 'invite_code_invalid');
  perform pg_temp.expect_error(
    format('select pg_temp.new_user(%L, ''inv-x@example.com'', ''email'', ''{"invite_code":"ZZZZZZZZ"}'')', alice_id),
    'invite_code_invalid');
  raise notice 'OK';

  raise notice '--- 4. Création de compte qui échoue : le code n''est PAS brûlé ---';
  update public.feature_flags set enabled = false where key = 'signups';
  perform pg_temp.expect_error(
    format('select pg_temp.new_user(%L, ''inv-alice@example.com'', ''email'', %L)',
      alice_id, json_build_object('invite_code', admin_code)::text),
    'temporairement fermées');
  update public.feature_flags set enabled = true where key = 'signups';
  if (select is_used from public.invite_codes where code = admin_code) then
    raise exception 'Le code a été brûlé alors que la création du compte a échoué';
  end if;
  raise notice 'OK';

  raise notice '--- 5. Inscription avec code valide : compte actif, code consommé ---';
  perform pg_temp.new_user(alice_id, 'inv-alice@example.com', 'email',
    json_build_object('invite_code', lower(admin_code), 'username', 'inv_alice')::jsonb);
  if not (select invite_ok from public.profiles where id = alice_id) then
    raise exception 'Le compte e-mail devrait être actif (invite_ok)';
  end if;
  if not exists (select 1 from public.invite_codes
                 where code = admin_code and is_used and used_by = alice_id and used_at is not null) then
    raise exception 'Le code devrait être consommé par alice';
  end if;
  raise notice 'OK';

  raise notice '--- 6. Code déjà utilisé : refusé (et check_invite_code le dit invalide) ---';
  perform pg_temp.expect_error(
    format('select pg_temp.new_user(%L, ''inv-bob@example.com'', ''email'', %L)',
      bob_id, json_build_object('invite_code', admin_code)::text),
    'invite_code_invalid');
  if public.check_invite_code(admin_code) then
    raise exception 'check_invite_code() ne doit pas accepter un code utilisé';
  end if;
  raise notice 'OK';

  raise notice '--- 7. Code expiré / révoqué : refusé ---';
  perform pg_temp.as_user(adm_id);
  select code into admin_code from public.admin_generate_invite_code();
  perform pg_temp.as_postgres();
  update public.invite_codes set expires_at = now() - interval '1 minute' where code = admin_code;
  perform pg_temp.expect_error(
    format('select pg_temp.new_user(%L, ''inv-bob@example.com'', ''email'', %L)',
      bob_id, json_build_object('invite_code', admin_code)::text),
    'invite_code_invalid');
  perform pg_temp.as_user(adm_id);
  select code into admin_code from public.admin_generate_invite_code();
  perform public.admin_revoke_invite_code((select id from public.invite_codes where code = admin_code));
  perform pg_temp.as_postgres();
  perform pg_temp.expect_error(
    format('select pg_temp.new_user(%L, ''inv-bob@example.com'', ''email'', %L)',
      bob_id, json_build_object('invite_code', admin_code)::text),
    'invite_code_invalid');
  raise notice 'OK';

  raise notice '--- 8. Compte Google : créé en attente, bloqué, activé par un code ---';
  perform pg_temp.as_user(adm_id);
  select code into admin_code from public.admin_generate_invite_code();
  perform pg_temp.as_postgres();
  perform pg_temp.new_user(goog_id, 'inv-google@example.com', 'google');
  if (select invite_ok from public.profiles where id = goog_id) then
    raise exception 'Un nouveau compte Google doit être en attente (invite_ok = false)';
  end if;
  if not public.is_banned(goog_id) then
    raise exception 'Un compte en attente doit être bloqué (is_banned)';
  end if;
  perform pg_temp.as_user(goog_id);
  -- Le client ne peut pas s'activer lui-même.
  perform pg_temp.expect_error(
    format('update public.profiles set invite_ok = true where id = %L', goog_id),
    'invite_ok ne peut pas être modifié');
  if public.consume_invite_code('ZZZZZZZZ') then
    raise exception 'consume_invite_code() ne doit pas accepter un mauvais code';
  end if;
  if (select invite_ok from public.profiles where id = goog_id) then
    raise exception 'Le compte ne doit pas être activé par un mauvais code';
  end if;
  if not public.consume_invite_code(admin_code) then
    raise exception 'consume_invite_code() devrait accepter un code valide';
  end if;
  if not (select invite_ok from public.profiles where id = goog_id) or public.is_banned(goog_id) then
    raise exception 'Le compte Google devrait être actif après consommation';
  end if;
  if not public.consume_invite_code('N''IMPORTE QUOI') then
    raise exception 'consume_invite_code() doit être idempotent pour un compte déjà actif';
  end if;
  raise notice 'OK';

  raise notice '--- 9. Interrupteur beta_fermee coupé : inscription publique sans code ---';
  perform pg_temp.as_postgres();
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(open_id, 'inv-open@example.com', 'email');
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  if not (select invite_ok from public.profiles where id = open_id) then
    raise exception 'Flag coupé : le compte devrait être actif';
  end if;
  raise notice 'OK';

  raise notice '--- 10. Parrainage : ancienneté, focus, limite mensuelle ---';
  perform pg_temp.as_user(alice_id);
  perform pg_temp.expect_error('select * from public.user_generate_invite_code()', 'account_too_young');
  perform pg_temp.as_postgres();
  update auth.users set created_at = now() - interval '8 days' where id = alice_id;
  perform pg_temp.as_user(alice_id);
  perform pg_temp.expect_error('select * from public.user_generate_invite_code()', 'not_enough_focus');

  -- 9 h 58 min : insuffisant ; une pause ou une session non terminée ne compte pas.
  perform pg_temp.as_postgres();
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, completed)
  values (alice_id, 'focus', 35900, 35900, now() - interval '3 days', now() - interval '3 days' + interval '35900 seconds', true),
         (alice_id, 'short_break', 3600, 3600, now() - interval '2 days', now() - interval '2 days' + interval '1 hour', true),
         (alice_id, 'focus', 3600, 3600, now() - interval '1 day', null, false);
  perform pg_temp.as_user(alice_id);
  perform pg_temp.expect_error('select * from public.user_generate_invite_code()', 'not_enough_focus');

  -- Une valeur gonflée par le client est plafonnée par le temps réel écoulé.
  perform pg_temp.as_postgres();
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, completed)
  values (alice_id, 'focus', 60, 99999, now() - interval '1 hour', now() - interval '1 hour' + interval '60 seconds', true);
  perform pg_temp.as_user(alice_id);
  perform pg_temp.expect_error('select * from public.user_generate_invite_code()', 'not_enough_focus');

  -- Encore 60 s : 35900 + 60 + 60 = 36020 ≥ 36000.
  perform pg_temp.as_postgres();
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, completed)
  values (alice_id, 'focus', 60, 60, now() - interval '30 minutes', now() - interval '30 minutes' + interval '60 seconds', true);
  perform pg_temp.as_user(alice_id);
  select * into elig from public.get_invite_eligibility();
  if elig.focus_seconds <> 36020 or elig.focus_required_seconds <> 36000
     or elig.account_age_days < 8 or elig.codes_this_month <> 0 or elig.codes_monthly_limit <> 2 then
    raise exception 'get_invite_eligibility() inattendu : %', elig;
  end if;

  select code into user_code from public.user_generate_invite_code();
  select code into second_code from public.user_generate_invite_code();
  if user_code = second_code then
    raise exception 'Deux codes identiques';
  end if;
  perform pg_temp.expect_error('select * from public.user_generate_invite_code()', 'monthly_limit_reached');
  select * into elig from public.get_invite_eligibility();
  if elig.codes_this_month <> 2 or elig.next_reset_at <= now() then
    raise exception 'Compteur mensuel / reset inattendu : %', elig;
  end if;
  if (select expires_at from public.invite_codes where code = user_code) < now() + interval '6 days 23 hours' then
    raise exception 'Un code utilisateur doit durer ~7 jours';
  end if;
  raise notice 'OK : 2 codes générés, le 3e refusé (reset le %)', elig.next_reset_at;

  raise notice '--- 11. Le code parrain fonctionne, et l''invitant le voit utilisé ---';
  perform pg_temp.as_postgres();
  perform pg_temp.new_user(carol_id, 'inv-carol@example.com', 'email',
    json_build_object('invite_code', user_code, 'username', 'inv_carol')::jsonb);
  perform pg_temp.as_user(alice_id);
  select count(*) into n from public.list_my_invite_codes() where status = 'used' and used_by_username is not null;
  if n <> 1 then
    raise exception 'list_my_invite_codes() devrait montrer 1 code utilisé, reçu %', n;
  end if;
  -- Bob ne voit pas les codes d'alice.
  perform pg_temp.as_user(bob_id);
  select count(*) into n from public.list_my_invite_codes();
  if n <> 0 then
    raise exception 'Un autre utilisateur ne doit voir aucun de ces codes';
  end if;
  raise notice 'OK';

  raise notice '--- 12. Droits : aucune écriture directe, anon ne lit rien ---';
  perform pg_temp.as_user(alice_id);
  set local role authenticated;
  begin
    insert into public.invite_codes (code, created_by, type) values ('AAAAAAAA', alice_id, 'user');
    raise exception 'ATTENDU : insert direct refusé';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invite_codes set is_used = false;
    raise exception 'ATTENDU : update direct refusé';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.invite_codes;
  if n <> 2 then
    raise exception 'RLS : alice ne doit voir que ses 2 codes, reçu %', n;
  end if;
  reset role;
  set local role anon;
  begin
    perform 1 from public.invite_codes;
    raise exception 'ATTENDU : select anon refusé';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_generate_invite_code();
    raise exception 'ATTENDU : fonction admin refusée à anon';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'OK';

  raise notice '--- 13. Limitation de débit de check_invite_code() ---';
  perform pg_temp.as_postgres();
  delete from public.invite_code_attempts;
  for n in 1..10 loop
    ok := public.check_invite_code('ZZZZZZZZ');
  end loop;
  perform pg_temp.expect_error('select public.check_invite_code(''ZZZZZZZZ'')', 'too_many_attempts');
  raise notice 'OK';

  raise notice '=== TOUT EST PASSÉ : codes d''invitation OK ===';
end;
$$;

rollback;
