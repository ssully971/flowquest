-- LOT M2 — test manuel des 3 modes de salon (migration 0049) : Pomodoro (enchaînement
-- automatique des phases, pauses courte/longue), Minuteur (fin naturelle), Chrono (sans
-- durée), enregistrement des sessions de groupe dans focus_sessions (temps réel, pilier,
-- arrivée tardive, départ anticipé), validations. À exécuter dans l'éditeur SQL Supabase
-- après 0049_rooms_modes.sql ; une seule transaction annulée à la fin (ROLLBACK).
-- Le temps est « voyagé » en reculant started_at des salons (le serveur ne dépend que
-- d'horodatages).

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
    mail, extensions.crypt('m2-test', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
$$;

-- Recule le début de la phase courante de p_ms (comme si le temps avait passé).
create or replace function pg_temp.rewind(p_room uuid, p_ms bigint)
returns void language sql as $$
  update public.rooms set started_at = started_at - (p_ms || ' milliseconds')::interval where id = p_room;
$$;

do $$
declare
  hst uuid := 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
  gst uuid := 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
  lte uuid := 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
  my_pillar uuid;
  r1 uuid; r2 uuid; r3 uuid;
  rec record;
  n integer;
  total integer;
begin
  update public.feature_flags set enabled = false where key = 'beta_fermee';
  perform pg_temp.new_user(hst, 'm2-host@example.com');
  perform pg_temp.new_user(gst, 'm2-guest@example.com');
  perform pg_temp.new_user(lte, 'm2-late@example.com');
  update public.feature_flags set enabled = true where key = 'beta_fermee';
  insert into public.friendships (requester_id, addressee_id, status) values (hst, gst, 'accepted'), (hst, lte, 'accepted');
  insert into public.pillars (user_id, name, color) values (gst, 'Travail', '#7C3AED') returning id into my_pillar;

  raise notice '--- 1. Validations de création ---';
  perform pg_temp.as_user(hst);
  begin perform public.create_room(25, array[gst], 'inconnu'); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;
  begin perform public.create_room(2, array[gst], 'countdown'); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;
  begin perform public.create_room(25, array[gst], 'pomodoro', 5, 15, 1); raise exception 'ATTENDU'; exception when others then
    if sqlerrm = 'ATTENDU' then raise; end if; end;

  raise notice '--- 2. Pomodoro 25/5/15, long après 2 focus : enchaînement automatique ---';
  r1 := public.create_room(25, array[gst, lte], 'pomodoro', 5, 15, 2);
  perform pg_temp.as_user(gst);
  perform public.respond_room_invite(r1, true, my_pillar);
  perform pg_temp.as_user(hst);
  perform public.start_room(r1);
  if (select r.phase || r.phase_index from public.rooms r where r.id = r1) <> 'focus0' then
    raise exception 'Phase initiale attendue focus 0';
  end if;

  -- Fin de la 1re phase de focus (25 min) : pause courte, 25 min de focus enregistrées.
  perform pg_temp.rewind(r1, 25 * 60000 + 1000);
  perform count(*) from public.get_room_state(r1);
  select * into rec from public.rooms where id = r1;
  if rec.phase <> 'short_break' or rec.phase_index <> 1 or rec.duration_ms <> 5 * 60000 then
    raise exception 'Après le 1er focus : pause courte attendue, reçu % %', rec.phase, rec.phase_index;
  end if;
  select count(*) into n from public.focus_sessions where user_id in (hst, gst) and kind = 'focus' and actual_seconds = 1500;
  if n <> 2 then raise exception '2 sessions de focus de 25 min attendues (hôte + invité), reçu %', n; end if;
  if not exists (select 1 from public.focus_sessions where user_id = gst and pillar_id is not null and kind = 'focus') then
    raise exception 'Le pilier de l''invité devrait être rattaché à sa session';
  end if;
  if (select current_xp from public.pillars where id = my_pillar) <> 250 then
    raise exception 'XP du pilier attendu 250 (25 min), reçu %', (select current_xp from public.pillars where id = my_pillar);
  end if;

  -- Fin de la pause courte puis du 2e focus : pause LONGUE (2 focus).
  perform pg_temp.rewind(r1, 5 * 60000 + 1000);
  perform pg_temp.as_user(gst);
  perform count(*) from public.get_room_state(r1);
  perform pg_temp.rewind(r1, 25 * 60000 + 1000);
  perform count(*) from public.get_room_state(r1);
  select * into rec from public.rooms where id = r1;
  if rec.phase <> 'long_break' or rec.phase_index <> 3 or rec.duration_ms <> 15 * 60000 then
    raise exception 'Pause longue attendue (phase 3), reçu % %', rec.phase, rec.phase_index;
  end if;
  select count(*) into n from public.focus_sessions where user_id = hst and kind = 'short_break' and actual_seconds = 300;
  if n <> 1 then raise exception 'Pause courte de 5 min attendue dans l''historique'; end if;

  raise notice '--- 3. Rattrapage : plusieurs phases écoulées sans que personne n''interroge ---';
  perform pg_temp.rewind(r1, (15 + 25 + 5 + 25) * 60000 + 5000);
  perform count(*) from public.get_room_state(r1);
  select * into rec from public.rooms where id = r1;
  if rec.phase_index <> 7 then raise exception 'Après rattrapage : phase 7 attendue, reçu %', rec.phase_index; end if;

  raise notice '--- 4. Départ anticipé : mes minutes sont enregistrées, pas celles des autres ---';
  perform pg_temp.as_user(hst);
  perform pg_temp.rewind(r1, 7 * 60000);
  perform pg_temp.as_user(gst);
  perform public.leave_room(r1);
  if not exists (select 1 from public.focus_sessions where user_id = gst and completed = false and actual_seconds between 415 and 430) then
    raise exception 'Le départ devrait enregistrer ~7 min (non terminées)';
  end if;

  raise notice '--- 5. Fin par l''hôte : phase en cours enregistrée, salon terminé ---';
  perform pg_temp.as_user(hst);
  perform public.end_room(r1);
  if (select status from public.rooms where id = r1) <> 'ended' then raise exception 'Salon terminé attendu'; end if;

  raise notice '--- 6. Minuteur (countdown) : fin naturelle, une seule session par participant ---';
  r2 := public.create_room(30, array[lte], 'countdown');
  perform pg_temp.as_user(lte);
  perform public.respond_room_invite(r2, true);
  perform pg_temp.as_user(hst);
  perform public.start_room(r2);
  perform pg_temp.rewind(r2, 31 * 60000);
  perform count(*) from public.get_room_state(r2);
  if (select status from public.rooms where id = r2) <> 'ended' then raise exception 'Le minuteur devrait être terminé'; end if;
  select count(*) into n from public.focus_sessions where user_id in (hst, lte) and actual_seconds = 1800 and completed;
  if n <> 2 then raise exception '2 sessions de 30 min terminées attendues, reçu %', n; end if;
  -- Rejouer ne crée pas de doublon.
  perform count(*) from public.get_room_state(r2);
  select count(*) into n from public.focus_sessions where user_id in (hst, lte) and actual_seconds = 1800;
  if n <> 2 then raise exception 'Doublon de sessions'; end if;

  raise notice '--- 7. Chrono : sans durée, pause/reprise, arrivée tardive proratisée ---';
  r3 := public.create_room(null, array[gst, lte], 'stopwatch');
  if (select duration_ms from public.rooms where id = r3) is not null then raise exception 'Chrono sans durée'; end if;
  perform public.start_room(r3);
  if (select duration_ms from public.rooms where id = r3) is not null then raise exception 'Chrono : duration_ms doit rester null'; end if;
  perform pg_temp.rewind(r3, 10 * 60000);
  perform public.pause_room(r3);
  if abs((select elapsed_ms_at_pause from public.rooms where id = r3) - 600000) > 2000 then
    raise exception 'Pause du chrono : ~10 min attendues';
  end if;
  perform public.resume_room(r3);
  perform pg_temp.as_user(lte);
  perform public.respond_room_invite(r3, true); -- arrive après ~10 min
  perform pg_temp.as_user(hst);
  perform pg_temp.rewind(r3, 5 * 60000); -- encore 5 min ensemble
  perform public.end_room(r3);
  select actual_seconds into total from public.focus_sessions where user_id = hst and actual_seconds between 890 and 910;
  if total is null then raise exception 'L''hôte devrait avoir ~15 min de chrono'; end if;
  select actual_seconds into total from public.focus_sessions where user_id = lte and actual_seconds between 290 and 310;
  if total is null then raise exception 'L''arrivant tardif devrait avoir ~5 min (pas 15)'; end if;

  raise notice '=== TOUT EST PASSÉ : modes de salon OK ===';
end;
$$;

rollback;
