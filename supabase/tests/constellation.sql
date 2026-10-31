-- LOT 6B — test manuel de la migration 0058 : task_links, constellation_layouts et garde-fou
-- focus_sessions.task_id. À exécuter dans l'éditeur SQL Supabase après 0058_constellation.sql ;
-- transaction annulée (ROLLBACK).
begin;

do $$
declare
  a uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b81';
  b uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b82';
  t1 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01';
  t2 uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02';
  tb uuid := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03';
  l record;
  s record;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         'cs' || i || '@example.com', 'x', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, '', '', '', ''
    from (values (a, 1), (b, 2)) as t(u, i);
  update public.feature_flags set enabled = true where key = 'beta_fermee';

  insert into public.tasks (id, user_id, title) values (t1, a, 'T1'), (t2, a, 'T2'), (tb, b, 'TB');

  raise notice '--- 1. Un lien entre deux de MES tâches est accepté ---';
  insert into public.task_links (user_id, from_task_id, to_task_id, kind) values (a, t1, t2, 'depends_on');

  raise notice '--- 2. Un lien vers la tâche d''un autre utilisateur est refusé ---';
  begin
    insert into public.task_links (user_id, from_task_id, to_task_id, kind) values (a, t1, tb, 'related');
    raise exception 'Le lien vers une tâche étrangère aurait dû échouer';
  exception when sqlstate '42501' then null;
  end;

  raise notice '--- 3. Pas de lien d''une tâche vers elle-même ---';
  begin
    insert into public.task_links (user_id, from_task_id, to_task_id, kind) values (a, t1, t1, 'related');
    raise exception 'Le lien vers soi-même aurait dû échouer';
  exception when check_violation then null;
  end;

  raise notice '--- 4. « related » est canonique : A↔B et B↔A ne coexistent pas ---';
  insert into public.task_links (user_id, from_task_id, to_task_id, kind) values (a, t2, t1, 'related');
  begin
    insert into public.task_links (user_id, from_task_id, to_task_id, kind) values (a, t1, t2, 'related');
    raise exception 'Le doublon related aurait dû échouer';
  exception when unique_violation then null;
  end;
  select * into l from public.task_links where kind = 'related' and user_id = a;
  if l.from_task_id::text > l.to_task_id::text then raise exception 'Lien related non canonique'; end if;

  raise notice '--- 5. Supprimer une tâche supprime ses liens ---';
  delete from public.tasks where id = t2;
  if exists (select 1 from public.task_links where user_id = a) then
    raise exception 'Les liens de la tâche supprimée devaient disparaître';
  end if;

  raise notice '--- 6. Une session avec une tâche inconnue est gardée, sans tâche ---';
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, task_id)
  values (a, 'focus', 600, 600, now() - interval '10 minutes', now(), gen_random_uuid()) returning * into s;
  if s.task_id is not null then raise exception 'task_id inconnu devait être remis à NULL'; end if;

  raise notice '--- 7. Une session avec ma tâche garde son task_id ---';
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, task_id)
  values (a, 'focus', 600, 600, now() - interval '30 minutes', now() - interval '20 minutes', t1) returning * into s;
  if s.task_id is distinct from t1 then raise exception 'task_id valide devait être conservé'; end if;

  raise notice '--- 8. Positions : une ligne par utilisateur ---';
  insert into public.constellation_layouts (user_id, positions) values (a, '{"n1":{"x":1,"y":2}}');
  begin
    insert into public.constellation_layouts (user_id, positions) values (a, '{}');
    raise exception 'Une seconde ligne aurait dû échouer';
  exception when unique_violation then null;
  end;

  raise notice 'OK — tous les tests de 0058 passent';
end $$;

rollback;
