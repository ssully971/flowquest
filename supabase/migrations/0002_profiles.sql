-- Table des profils (liée 1:1 à auth.users), créée automatiquement à l'inscription.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  timezone text not null default 'Europe/Paris',
  stats_visibility text not null default 'public' check (stats_visibility in ('public', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Le rôle ne peut JAMAIS être changé par une requête authentifiée côté client (anon/authenticated),
-- même si la ligne lui appartient. auth.uid() est NULL quand la requête vient de l'éditeur SQL
-- Supabase (exécutée en tant que postgres) : c'est le seul chemin autorisé pour promouvoir un admin.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Le rôle ne peut pas être modifié depuis le client. Passe par le SQL administrateur (voir docs/SECURITE.md).';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- Création automatique du profil à l'inscription (email+mot de passe ou Google).
-- Le pseudo vient de raw_user_meta_data.username (fourni par le formulaire d'inscription email).
-- S'il est absent (connexion Google) ou déjà pris, un pseudo de repli unique est généré ;
-- l'utilisateur peut le changer ensuite depuis Compte.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix text;
begin
  base_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  if base_username is null or length(base_username) < 3 then
    base_username := 'joueur';
  end if;

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := substr(md5(random()::text), 1, 4);
    final_username := base_username || '_' || suffix;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
