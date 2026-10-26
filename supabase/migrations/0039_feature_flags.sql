-- Panneau Admin refait (lot I2, §1) : coupe-circuits. Table de lecture publique (aucune
-- donnée sensible — un libellé, une description, un état on/off), écriture réservée aux
-- admins via une RPC SECURITY DEFINER dédiée (jamais de politique UPDATE pour le client,
-- même principe que `friendships`/`cheers`). Ajoutée à `supabase_realtime` pour que
-- useFeatureFlag() reflète un changement en quelques secondes, sans rechargement.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  label text not null,
  description text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Lecture publique (anon compris) : un visiteur non connecté doit aussi voir, par
-- exemple, que les inscriptions sont fermées ou qu'un bandeau de maintenance est actif,
-- avant même de se connecter.
drop policy if exists "feature_flags_select_all" on public.feature_flags;
create policy "feature_flags_select_all" on public.feature_flags
  for select
  using (true);

-- Pas de politique INSERT/UPDATE/DELETE : toute écriture passe par
-- admin_set_feature_flag() ci-dessous.

grant select on public.feature_flags to anon, authenticated;

-- Dix drapeaux initiaux (lot I2, §1). `label`/`description` sont le texte affiché dans le
-- panneau Admin, pas des clés i18n (texte admin uniquement, jamais montré aux
-- utilisateurs normaux) — réinsérés ici avec `on conflict do nothing` pour ne jamais
-- écraser une description que tu aurais déjà modifiée depuis l'admin (ex. le message du
-- bandeau de maintenance).
insert into public.feature_flags (key, enabled, label, description) values
  ('galaxy', true, 'Galaxie', 'Visualisation en galaxie des sessions, dans Réglages > Piliers.'),
  ('pillars', true, 'Piliers de vie', 'Piliers, XP, radar et galaxie. Coupe aussi « galaxy » côté interface.'),
  ('deep_focus', true, 'Deep Focus', 'Mise en page minimale plein écran pendant une session.'),
  ('friends', true, 'Amis', 'Demandes d’amitié, liste d’amis, statut en direct.'),
  ('rooms', true, 'Salons de focus', 'Sessions de focus partagées entre amis.'),
  ('leaderboard', true, 'Classement', 'Classement hebdomadaire entre amis.'),
  ('cheers', true, 'Encouragements', 'Envoi d’emojis d’encouragement entre amis.'),
  ('avatar_upload', true, 'Photos de profil', 'Téléversement d’une photo de profil.'),
  ('signups', true, 'Inscriptions ouvertes', 'Autorise la création de nouveaux comptes.'),
  ('maintenance', false, 'Maintenance', 'Bandeau discret affiché à tous quand activé — modifie ce texte pour changer le message.')
on conflict (key) do nothing;

-- Vérifiée par les fonctions serveur critiques ci-dessous (salons, encouragements,
-- photos) ET par le client (useFeatureFlag) — la base fait foi, l'interface n'est qu'un
-- confort. `stable` (lit sans modifier), security definer pour rester appelable depuis
-- une autre fonction SECURITY DEFINER sans recoupler de permissions.
create or replace function public.is_feature_enabled(flag_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ff.enabled from public.feature_flags ff where ff.key = flag_key), true);
$$;

grant execute on function public.is_feature_enabled(text) to authenticated, anon;

-- Écriture admin exclusive (lot I2, §1) : vérifie is_admin(), journalise dans admin_log
-- (qui, quoi : la clé du drapeau et son nouvel état — jamais de contenu). `new_description`
-- optionnel (défaut null = inchangé) : seul le drapeau « maintenance » a un message
-- modifiable dans l'interface admin, mais la fonction reste générique.
create or replace function public.admin_set_feature_flag(
  flag_key text,
  new_enabled boolean,
  new_description text default null
)
returns public.feature_flags
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.feature_flags;
begin
  if not public.is_admin() then
    raise exception 'admin_set_feature_flag() réservé aux administrateurs';
  end if;

  update public.feature_flags ff
  set
    enabled = new_enabled,
    description = coalesce(new_description, ff.description),
    updated_by = auth.uid(),
    updated_at = now()
  where ff.key = flag_key
  returning * into result;

  if not found then
    raise exception 'Drapeau inconnu : %', flag_key;
  end if;

  insert into public.admin_log (admin_id, action, target)
  values (
    auth.uid(),
    case when new_enabled then 'feature_flag.enable' else 'feature_flag.disable' end,
    flag_key
  );

  return result;
end;
$$;

grant execute on function public.admin_set_feature_flag(text, boolean, text) to authenticated;
revoke execute on function public.admin_set_feature_flag(text, boolean, text) from anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feature_flags'
  ) then
    execute 'alter publication supabase_realtime add table public.feature_flags';
  end if;
end;
$$;

-- Application du drapeau côté serveur (lot I2, §1 : « la base fait foi, pas seulement
-- l'interface ») pour les trois fonctions explicitement visées — salons, encouragements,
-- photos de profil.

create or replace function public.create_room(p_focus_minutes integer, p_friend_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  new_room_id uuid;
  friend_id uuid;
  valid_friend_ids uuid[] := array[]::uuid[];
begin
  if current_uid is null then
    raise exception 'create_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if not public.is_feature_enabled('rooms') then
    raise exception 'Les salons de focus sont temporairement indisponibles';
  end if;
  if p_focus_minutes is null or p_focus_minutes < 5 or p_focus_minutes > 120 then
    raise exception 'La durée doit être comprise entre 5 et 120 minutes';
  end if;

  foreach friend_id in array coalesce(p_friend_ids, array[]::uuid[])
  loop
    if friend_id = current_uid or friend_id = any(valid_friend_ids) then
      continue;
    end if;
    if not public.are_friends(current_uid, friend_id) then
      continue;
    end if;
    valid_friend_ids := valid_friend_ids || friend_id;
  end loop;

  if array_length(valid_friend_ids, 1) is null then
    raise exception 'Invite au moins un ami pour créer un salon';
  end if;
  if array_length(valid_friend_ids, 1) > 5 then
    raise exception 'Un salon réunit au plus 6 personnes (toi compris)';
  end if;

  insert into public.rooms (host_id, focus_minutes) values (current_uid, p_focus_minutes)
  returning id into new_room_id;

  insert into public.room_participants (room_id, user_id, role, status, joined_at, last_seen_at)
  values (new_room_id, current_uid, 'host', 'joined', now(), now());

  foreach friend_id in array valid_friend_ids
  loop
    insert into public.room_participants (room_id, user_id, role, status)
    values (new_room_id, friend_id, 'member', 'invited');
  end loop;

  return new_room_id;
end;
$$;

create or replace function public.send_cheer(p_recipient_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  recent_to_recipient integer;
  daily_count integer;
begin
  if current_uid is null then
    raise exception 'send_cheer() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if not public.is_feature_enabled('cheers') then
    raise exception 'Les encouragements sont temporairement indisponibles';
  end if;
  if p_recipient_id = current_uid then
    raise exception 'Impossible de s’encourager soi-même';
  end if;
  if p_emoji not in ('💪', '🔥', '👏', '❤️', '☕') then
    raise exception 'Emoji non autorisé';
  end if;
  if not public.are_friends(current_uid, p_recipient_id) then
    raise exception 'Vous devez être amis pour envoyer un encouragement';
  end if;

  select count(*) into recent_to_recipient
  from public.cheers
  where sender_id = current_uid and recipient_id = p_recipient_id
    and created_at >= now() - interval '10 minutes';
  if recent_to_recipient > 0 then
    raise exception 'Attends un peu avant de ré-encourager cette personne';
  end if;

  select count(*) into daily_count
  from public.cheers
  where sender_id = current_uid and created_at >= now() - interval '1 day';
  if daily_count >= 30 then
    raise exception 'Limite quotidienne d’encouragements atteinte';
  end if;

  insert into public.cheers (sender_id, recipient_id, emoji)
  values (current_uid, p_recipient_id, p_emoji);
end;
$$;

-- Photos de profil : le drapeau coupe l'upload (storage.objects, policy INSERT) — la
-- lecture et la suppression (y compris admin_remove_avatar, déjà réservée aux admins)
-- restent possibles même drapeau coupé, seul le téléversement par l'utilisateur est bloqué.
drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_feature_enabled('avatar_upload')
  );

-- Inscriptions ouvertes (lot I2, §1) : bloque la création même via l'API Auth directe,
-- pas seulement l'onglet « Inscription » masqué côté client — handle_new_user() tourne
-- en trigger AFTER INSERT sur auth.users, dans la même transaction : une exception ici
-- annule l'insertion auth.users entière (la création de compte échoue proprement côté
-- client, avec le message d'erreur Supabase Auth générique).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consented boolean := coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false);
begin
  if not public.is_feature_enabled('signups') then
    raise exception 'Les inscriptions sont temporairement fermées';
  end if;

  insert into public.profiles (id, username, display_name, marketing_consent, marketing_consent_at)
  values (
    new.id,
    public.generate_unique_username(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'),
    consented,
    case when consented then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
