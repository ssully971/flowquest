-- LOT A — test manuel de la migration 0054 : gels de série (sync_streak_freezes).
-- À exécuter dans l'éditeur SQL Supabase après 0054_streak_freezes.sql ; transaction
-- annulée (ROLLBACK). Les sessions sont insérées avec started_at/ended_at cohérents pour
-- passer le garde-fou de la migration 0052.
begin;

do $$
declare
  uid uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380f01';
  r jsonb;
  today date := (now() at time zone 'UTC')::date;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'freeze@example.com', 'x', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, '', '', '', ''
  );
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  update public.profiles set timezone = 'UTC' where id = uid;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);

  raise notice '--- 1. Première synchro : aucun jour passé couvert, stock = 0 ---';
  r := public.sync_streak_freezes(120);
  if (r->>'stock')::int <> 0 or jsonb_array_length(r->'used_days') <> 0 then
    raise exception 'Init attendue vide, reçu %', r;
  end if;

  raise notice '--- 2. Rejouer sans changement est idempotent ---';
  r := public.sync_streak_freezes(120);
  if (r->>'stock')::int <> 0 then raise exception 'Idempotence rompue : %', r; end if;

  raise notice '--- 3. Gain : 10 h cumulées sur des jours passés = 1 gel ---';
  -- On recule le curseur pour simuler que le compte existait déjà il y a 6 jours.
  update public.streak_freeze_state
     set processed_through = today - 7, accounted_seconds = 0, stock = 0, alive = true
   where user_id = uid;
  -- J-6..J-3 : 3 h chacun (objectif 2 h atteint) = 12 h => 1 gel (franchissement des 10 h le J-3 : 9 h => J-2 non, voir ci-dessous)
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at)
  select uid, 'focus', 10800, 10800, d + time '08:00', d + time '11:00'
    from generate_series(today - 6, today - 3, interval '1 day') as g(d);
  -- J-2 et J-1 manqués (aucune session) ; stock au début : 12 h => 1 gel gagné au 4e jour.
  r := public.sync_streak_freezes(120);
  if (r->>'stock')::int <> 0 then raise exception 'Stock attendu 0 (1 gel gagné, 1 consommé, 1 jour non couvert), reçu %', r; end if;
  if jsonb_array_length(r->'used_days') <> 1 or (r->'used_days'->>0)::date <> today - 2 then
    raise exception 'Le gel devait couvrir J-2, reçu %', r->'used_days';
  end if;
  if (r->>'alive')::boolean then raise exception 'La série devait être retombée après J-1 sans gel'; end if;

  raise notice '--- 4. Rejouer ne consomme pas deux fois ---';
  r := public.sync_streak_freezes(120);
  if jsonb_array_length(r->'used_days') <> 1 then raise exception 'Double consommation : %', r; end if;

  raise notice '--- 5. Plafond à 3 : ~96 h gagnées sur 4 jours validés => stock 3 ---';
  delete from public.focus_sessions where user_id = uid;
  update public.streak_freeze_state
     set processed_through = today - 5, stock = 0, accounted_seconds = 0, alive = true
   where user_id = uid;
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at)
  select uid, 'focus', 21600, 21600, d + (h * interval '6 hours'), d + (h * interval '6 hours') + interval '6 hours'
    from generate_series(today - 4, today - 1, interval '1 day') as g(d), generate_series(0, 3) as h;
  r := public.sync_streak_freezes(120);
  if (r->>'stock')::int <> 3 then raise exception 'Stock attendu 3 (plafond), reçu %', r; end if;

  raise notice '--- 6. Appel anonyme refusé ---';
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.sync_streak_freezes(120);
    raise exception 'Un appel anonyme aurait dû échouer';
  exception when sqlstate '28000' then null;
  end;

  raise notice 'OK — tous les tests de 0054 passent';
end $$;

rollback;
