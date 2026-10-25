-- LOT H1 — test manuel des RPC salons/amis/classement, à exécuter TOI-MÊME dans
-- l'éditeur SQL Supabase (ou via psql) après avoir collé la migration
-- 0035_fix_ambiguous_columns.sql. Cet environnement n'a pas de projet Supabase en ligne
-- accessible, donc ce script n'a jamais pu être exécuté par moi — je ne peux pas te
-- garantir qu'il tourne sans ajustement sur TON projet (voir la note sur auth.users
-- plus bas).
--
-- Ce que ça fait : crée deux comptes de test réels (déclenche handle_new_user() comme une
-- vraie inscription), les rend amis, crée un salon, appelle get_room_state() et
-- list_duo_streaks() (les deux fonctions corrigées par 0035 — avant la correction, ces
-- appels échouent avec « column reference ... is ambiguous », erreur Postgres 42702),
-- plus list_my_rooms(), weekly_leaderboard(), les encouragements et le cycle complet
-- d'un salon. Tout tourne dans UNE SEULE transaction annulée à la fin (ROLLBACK) : rien
-- ne persiste dans ta base, tu peux le relancer autant de fois que tu veux.
--
-- Si l'insertion dans auth.users échoue (colonne manquante/NOT NULL différente), c'est que
-- le schéma auth.* de ta version de Supabase diffère légèrement de celui visé ici —
-- retire ou adapte les colonnes en cause, le reste du script ne dépend que des id/email.

begin;

do $$
declare
  host_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  friend_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  host_username text;
  friend_username text;
  friendship public.friendships;
  new_room_id uuid;
  room_rows integer;
  my_rooms_rows integer;
  streak_rows integer;
  leaderboard_rows integer;
  self_row_found boolean;
  unread_cheers integer;
begin
  raise notice '--- 1. Création de deux comptes de test (déclenche handle_new_user()) ---';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values
    (
      '00000000-0000-0000-0000-000000000000', host_id, 'authenticated', 'authenticated',
      'h1-test-host@example.com', crypt('h1-test-password', gen_salt('bf')), now(),
      now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
      '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', friend_id, 'authenticated', 'authenticated',
      'h1-test-friend@example.com', crypt('h1-test-password', gen_salt('bf')), now(),
      now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
      '', '', '', ''
    );

  select username into host_username from public.profiles where id = host_id;
  select username into friend_username from public.profiles where id = friend_id;
  if host_username is null or friend_username is null then
    raise exception 'Les profils n''ont pas été créés par handle_new_user() — trigger on_auth_user_created manquant ?';
  end if;
  raise notice 'OK : host=% (%), friend=% (%)', host_username, host_id, friend_username, friend_id;

  raise notice '--- 2. Amitié (send_friend_request / respond_friend_request) ---';
  perform set_config('request.jwt.claims', json_build_object('sub', host_id, 'role', 'authenticated')::text, true);
  select public.send_friend_request(p_username => friend_username) into friendship;
  if friendship.id is null then
    raise exception 'send_friend_request() n''a renvoyé aucune ligne';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', friend_id, 'role', 'authenticated')::text, true);
  perform public.respond_friend_request(friendship.id, true);
  if not exists (select 1 from public.friendships where id = friendship.id and status = 'accepted') then
    raise exception 'La demande n''est pas passée à accepted';
  end if;
  raise notice 'OK : amis';

  raise notice '--- 3. create_room() ---';
  perform set_config('request.jwt.claims', json_build_object('sub', host_id, 'role', 'authenticated')::text, true);
  select public.create_room(25, array[friend_id]) into new_room_id;
  if new_room_id is null then
    raise exception 'create_room() n''a renvoyé aucun id';
  end if;
  raise notice 'OK : salon %', new_room_id;

  raise notice '--- 4. get_room_state() côté hôte (exerce le correctif 0035 sur room_id/status) ---';
  select count(*) into room_rows from public.get_room_state(new_room_id);
  if room_rows <> 2 then
    raise exception 'get_room_state() attendu 2 lignes (hôte + invité), reçu %', room_rows;
  end if;
  raise notice 'OK : get_room_state() a renvoyé % lignes sans erreur "ambiguous"', room_rows;

  raise notice '--- 5. list_my_rooms() côté hôte ---';
  select count(*) into my_rooms_rows from public.list_my_rooms() where room_id = new_room_id;
  if my_rooms_rows <> 1 then
    raise exception 'list_my_rooms() n''a pas trouvé le salon créé';
  end if;
  raise notice 'OK : list_my_rooms()';

  raise notice '--- 6. get_room_state() côté invité (statut invited, exerce le correctif une 2e fois) ---';
  perform set_config('request.jwt.claims', json_build_object('sub', friend_id, 'role', 'authenticated')::text, true);
  select count(*) into room_rows from public.get_room_state(new_room_id);
  if room_rows <> 2 then
    raise exception 'get_room_state() (invité) attendu 2 lignes, reçu %', room_rows;
  end if;

  raise notice '--- 7. respond_room_invite() puis cycle démarrer/pause/reprendre/terminer ---';
  perform public.respond_room_invite(new_room_id, true);
  perform set_config('request.jwt.claims', json_build_object('sub', host_id, 'role', 'authenticated')::text, true);
  perform public.start_room(new_room_id);
  perform public.pause_room(new_room_id);
  perform public.resume_room(new_room_id);
  perform public.end_room(new_room_id);
  raise notice 'OK : cycle complet du salon';

  raise notice '--- 8. list_duo_streaks() (exerce le correctif 0035 sur current_streak/last_active_date) ---';
  select count(*) into streak_rows from public.list_duo_streaks();
  if streak_rows <> 1 then
    raise exception 'list_duo_streaks() attendu 1 ligne (l''ami), reçu %', streak_rows;
  end if;
  raise notice 'OK : list_duo_streaks() a renvoyé % ligne(s) sans erreur "ambiguous"', streak_rows;

  raise notice '--- 9. weekly_leaderboard() (exerce le correctif positionnel de l''ORDER BY) ---';
  select count(*), bool_or(is_self) into leaderboard_rows, self_row_found from public.weekly_leaderboard(0);
  if leaderboard_rows < 1 or not self_row_found then
    raise exception 'weekly_leaderboard() attendu au moins notre propre ligne';
  end if;
  raise notice 'OK : weekly_leaderboard() a renvoyé % ligne(s)', leaderboard_rows;

  raise notice '--- 10. Encouragements (send_cheer / list_unread_cheers / mark_cheers_read) ---';
  perform public.send_cheer(friend_id, '🔥');
  perform set_config('request.jwt.claims', json_build_object('sub', friend_id, 'role', 'authenticated')::text, true);
  select count(*) into unread_cheers from public.list_unread_cheers();
  if unread_cheers <> 1 then
    raise exception 'list_unread_cheers() attendu 1 encouragement non lu, reçu %', unread_cheers;
  end if;
  perform public.mark_cheers_read();
  raise notice 'OK : encouragements';

  raise notice '=== TOUT EST PASSÉ : aucune erreur "column reference ... is ambiguous" ===';
end;
$$;

rollback;
