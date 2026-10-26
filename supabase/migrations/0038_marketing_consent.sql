-- Consentement marketing (lot I1, §3) : case facultative « Je souhaite recevoir les
-- nouveautés par e-mail » à l'inscription, décochée par défaut, modifiable ensuite dans
-- Réglages > Compte. Sert de base légale (consentement RGPD) à toute newsletter future
-- (export CSV, lot I3) — jamais déduite d'autre chose qu'un choix explicite.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz;

-- RLS propriétaire : déjà en place sur public.profiles depuis la migration 0002
-- (profiles_select_own / profiles_update_own, sur auth.uid() = id) — une ALTER TABLE
-- n'ajoute pas de nouvelle policy, celles existantes couvrent déjà ces deux nouvelles
-- colonnes comme toute autre colonne modifiable de la ligne (le déclencheur
-- prevent_role_self_escalation ne concerne que `role`, sans effet ici). Revalidées ici
-- explicitement pour que cette migration documente elle-même la protection dont
-- héritent ces deux colonnes, sans avoir à rouvrir 0002_profiles.sql pour le vérifier.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- GRANT explicite (déjà accordé par 0002_profiles.sql sur la table entière ; réaffirmé
-- ici pour la même raison — rendre cette migration autoportante).
grant select, insert, update on public.profiles to authenticated;

-- handle_new_user() (0009_ensure_profile.sql) redéfinie pour lire le consentement
-- marketing transmis par le client à l'inscription (`options.data.marketing_consent`,
-- voir signUpWithEmail dans AuthProvider.tsx) — absent ou invalide, traité comme false
-- (jamais de consentement implicite). `marketing_consent_at` n'est horodaté que si la
-- case était cochée : son absence (null) signifie « jamais consenti », pas « consenti à
-- une date inconnue ».
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consented boolean := coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false);
begin
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

-- ensure_profile() (0009_ensure_profile.sql) : même lecture, depuis le JWT cette fois
-- (filet de sécurité si le trigger n'a pas tourné à l'inscription — voir sa propre
-- documentation dans 0009_ensure_profile.sql).
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  current_uid uuid := auth.uid();
  consented boolean;
begin
  if current_uid is null then
    raise exception 'ensure_profile() doit être appelé par un utilisateur authentifié';
  end if;

  select * into result from public.profiles where id = current_uid;
  if found then
    return result;
  end if;

  consented := coalesce((auth.jwt() -> 'user_metadata' ->> 'marketing_consent')::boolean, false);

  insert into public.profiles (id, username, display_name, marketing_consent, marketing_consent_at)
  values (
    current_uid,
    public.generate_unique_username(coalesce(
      auth.jwt() -> 'user_metadata' ->> 'username',
      split_part(coalesce(auth.jwt() ->> 'email', 'joueur'), '@', 1)
    )),
    coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', auth.jwt() -> 'user_metadata' ->> 'username'),
    consented,
    case when consented then now() else null end
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = current_uid;
  return result;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

notify pgrst, 'reload schema';
