-- LOT T — test manuel de la migration 0052 : plafond d'actual_seconds et colonnes de pause. À exécuter
-- dans l'éditeur SQL Supabase après 0052_focus_session_pauses.sql ; transaction annulée (ROLLBACK).
begin;

do $$
declare
  uid uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  s record;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    'clamp@example.com', 'x', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, '', '', '', ''
  );
  update public.feature_flags set enabled = true where key = 'beta_fermee';

  raise notice '--- 1. actual_seconds plafonné à la durée réelle de la session ---';
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, completed)
  values (uid, 'focus', 600, 99999, now() - interval '10 minutes', now(), false) returning * into s;
  if s.actual_seconds > 601 then raise exception 'actual_seconds devait être plafonné à ~600, reçu %', s.actual_seconds; end if;

  raise notice '--- 2. Une valeur légitime n''est jamais modifiée ---';
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, completed)
  values (uid, 'focus', 1500, 1500, now() - interval '25 minutes', now(), true) returning * into s;
  if s.actual_seconds <> 1500 then raise exception 'La valeur légitime 1500 a été modifiée : %', s.actual_seconds; end if;

  raise notice '--- 3. Plafond absolu de 24 h, même sans date de fin ---';
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at)
  values (uid, 'focus', 0, 500000, now() - interval '30 days') returning * into s;
  if s.actual_seconds <> 86400 then raise exception 'Plafond de 24 h attendu, reçu %', s.actual_seconds; end if;

  raise notice '--- 4. Temps de pause et pauses manuelles enregistrés (défaut 0, jamais négatifs) ---';
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at, paused_seconds, pause_count)
  values (uid, 'focus', 600, 300, now() - interval '10 minutes', now(), 120, 2) returning * into s;
  if s.paused_seconds <> 120 or s.pause_count <> 2 then raise exception 'Pauses mal enregistrées'; end if;
  insert into public.focus_sessions (user_id, kind, planned_seconds, actual_seconds, started_at, ended_at)
  values (uid, 'focus', 60, 60, now() - interval '1 minute', now()) returning * into s;
  if s.paused_seconds <> 0 or s.pause_count <> 0 then raise exception 'Défaut 0 attendu'; end if;

  raise notice 'OK — migration 0052 : plafond de durée et colonnes de pause.';
end;
$$;

rollback;
