-- LOT 3 — test manuel de la migration 0051 (admin : liste des comptes). À exécuter dans l'éditeur SQL
-- Supabase après 0051_admin_users_fix.sql ; une seule transaction annulée à la fin (ROLLBACK).
-- Vérifie : la liste fonctionne (l'e-mail varchar(255) est converti), un compte SANS profil apparaît
-- marqué profile_missing, la recherche et le tri fonctionnent, un non-admin est refusé, la réparation
-- crée le profil et est idempotente, l'export fonctionne.

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
    mail, extensions.crypt('a-test', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
$$;

do $$
declare
  adm uuid := 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  usr uuid := 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
  orphan uuid := 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
  n integer;
  rec record;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(adm, 'a-admin@example.com');
  perform pg_temp.new_user(usr, 'a-user@example.com');
  perform pg_temp.new_user(orphan, 'a-orphan@example.com');
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  update public.profiles set role = 'admin' where id = adm;
  -- Compte orphelin : créé avant le trigger de création automatique.
  delete from public.profiles where id = orphan;

  raise notice '--- 1. Un non-admin est refusé ---';
  perform pg_temp.as_user(usr);
  begin
    perform * from public.admin_list_users(20, 0, null, 'created_at_desc');
    raise exception 'ATTENDU';
  exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if;
  end;

  raise notice '--- 2. La liste fonctionne et inclut le compte sans profil ---';
  perform pg_temp.as_user(adm);
  select count(*) into n from public.admin_list_users(100, 0, null, 'created_at_desc')
    where id in (adm, usr, orphan);
  if n <> 3 then raise exception 'Les 3 comptes de test devraient apparaître, reçu %', n; end if;
  select * into rec from public.admin_list_users(100, 0, 'a-orphan', 'created_at_desc') where id = orphan;
  if rec.id is null or not rec.profile_missing then
    raise exception 'Le compte sans profil doit apparaître avec profile_missing = true';
  end if;
  if rec.email <> 'a-orphan@example.com' then raise exception 'E-mail attendu a-orphan@example.com, reçu %', rec.email; end if;
  select * into rec from public.admin_list_users(100, 0, null, 'username_asc') where id = usr;
  if rec.profile_missing then raise exception 'Un compte avec profil ne doit pas être marqué manquant'; end if;
  if rec.total_count < 3 then raise exception 'total_count doit compter les comptes, reçu %', rec.total_count; end if;

  raise notice '--- 3. Pagination et recherche ---';
  select count(*) into n from public.admin_list_users(1, 0, null, 'created_at_desc');
  if n <> 1 then raise exception 'limit 1 doit renvoyer une ligne, reçu %', n; end if;
  select count(*) into n from public.admin_list_users(20, 0, 'a-user@', 'created_at_desc');
  if n <> 1 then raise exception 'La recherche par e-mail doit trouver 1 compte, reçu %', n; end if;

  raise notice '--- 4. Réparation du profil manquant (idempotente) ---';
  perform public.admin_repair_profile(orphan);
  perform public.admin_repair_profile(orphan);
  if not exists (select 1 from public.profiles where id = orphan) then
    raise exception 'Le profil aurait dû être créé';
  end if;
  select * into rec from public.admin_list_users(100, 0, 'a-orphan', 'created_at_desc') where id = orphan;
  if rec.profile_missing then raise exception 'Après réparation, profile_missing doit être faux'; end if;
  perform pg_temp.as_user(usr);
  begin
    perform public.admin_repair_profile(orphan);
    raise exception 'ATTENDU';
  exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if;
  end;

  raise notice '--- 5. Export CSV ---';
  perform pg_temp.as_user(adm);
  select count(*) into n from public.admin_export_users(false) where email like 'a-%@example.com';
  if n <> 3 then raise exception 'L''export de tous les comptes doit renvoyer 3 lignes, reçu %', n; end if;

  raise notice 'OK — migration 0051 : liste des comptes, comptes sans profil, réparation, export.';
end;
$$;

rollback;
