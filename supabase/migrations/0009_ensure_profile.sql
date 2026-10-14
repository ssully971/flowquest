-- Corrige « Impossible de charger ton profil » : des comptes ont pu être créés avant que
-- ces migrations soient collées (le trigger on_auth_user_created n'existait pas encore),
-- ou tout autre aléa a pu empêcher la création de la ligne profiles. Cette migration ajoute
-- un filet de sécurité appelable depuis le client pour une session dont le profil manque,
-- sans jamais la rendre inutilisable. Idempotente : peut être recollée sans erreur.

-- Logique de pseudo unique extraite de handle_new_user() pour être réutilisée par
-- ensure_profile() ci-dessous, sans dupliquer le code.
create or replace function public.generate_unique_username(base_candidate text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix text;
begin
  base_username := lower(coalesce(base_candidate, 'joueur'));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  if base_username is null or length(base_username) < 3 then
    base_username := 'joueur';
  end if;

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := substr(md5(random()::text), 1, 4);
    final_username := base_username || '_' || suffix;
  end loop;

  return final_username;
end;
$$;

-- handle_new_user() redéfinie pour réutiliser generate_unique_username() (même comportement
-- qu'avant, juste sans duplication). on conflict en filet de sécurité supplémentaire si
-- ensure_profile() a déjà créé la ligne par ailleurs avant que ce trigger ne s'exécute.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    public.generate_unique_username(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Appelée par le client juste après la connexion si le select direct sur profiles ne
-- renvoie rien : crée la ligne manquante (pseudo de repli unique) si besoin, ou renvoie
-- simplement la ligne existante. Ne peut jamais créer ou lire la ligne d'un autre
-- utilisateur : current_uid vient uniquement de auth.uid(), jamais d'un paramètre.
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'ensure_profile() doit être appelé par un utilisateur authentifié';
  end if;

  select * into result from public.profiles where id = current_uid;
  if found then
    return result;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    current_uid,
    public.generate_unique_username(coalesce(
      auth.jwt() -> 'user_metadata' ->> 'username',
      split_part(coalesce(auth.jwt() ->> 'email', 'joueur'), '@', 1)
    )),
    coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', auth.jwt() -> 'user_metadata' ->> 'username')
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = current_uid;
  return result;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
