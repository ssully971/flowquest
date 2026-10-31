-- LOT 6A — test manuel de la migration 0057 : friends_pillar_levels. À exécuter dans
-- l'éditeur SQL Supabase après 0057_friends_pillar_levels.sql ; transaction annulée (ROLLBACK).
begin;

do $$
declare
  a uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a71';
  b uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a72';
  c uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a73';
  n int;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         'pl' || i || '@example.com', 'x', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, '', '', '', ''
    from (values (a, 1), (b, 2), (c, 3)) as t(u, i);
  update public.feature_flags set enabled = true where key = 'beta_fermee';

  -- a est ami avec b, pas avec c.
  insert into public.friendships (requester_id, addressee_id, status) values (a, b, 'accepted');
  update public.pillars set archived_at = null where user_id in (a, b, c);
  insert into public.pillars (user_id, name, color, level) values
    (a, 'Mes études', '#4A9FE8', 3), (b, 'Sport', '#5FB86B', 7), (b, 'Autre', '#F2555A', 2),
    (b, 'Vieux pilier', '#8A93A6', 20), (c, 'Secret', '#C77DD9', 9);
  update public.pillars set archived_at = now() where user_id = b and name = 'Vieux pilier';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  raise notice '--- 1. Soi-même et ses amis, jamais un inconnu ---';
  select count(*) into n from public.friends_pillar_levels();
  if n < 2 then raise exception 'Attendu au moins soi + ami, reçu %', n; end if;
  if exists (select 1 from public.friends_pillar_levels() where user_id = c) then
    raise exception 'Le niveau d''un non-ami ne doit pas être exposé';
  end if;

  raise notice '--- 2. Niveau max parmi les piliers NON archivés ---';
  select top_level into n from public.friends_pillar_levels() where user_id = b;
  if n <> 7 then raise exception 'Niveau de b attendu 7 (pilier archivé ignoré), reçu %', n; end if;

  raise notice 'OK — tous les tests de 0057 passent';
end $$;

rollback;
