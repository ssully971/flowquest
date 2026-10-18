-- Nouveautés / changelog affiché dans les réglages (§12, §9.x). `src/features/settings/changelog.ts`
-- garde son tableau statique en repli (invité hors-ligne, base vide) ; quand cette table contient des
-- lignes publiées, elle devient la source de vérité. `released_at` est une date (pas une heure) :
-- l'ordre d'affichage s'appuie sur elle, pas sur `created_at` (une entrée peut être rédigée après coup
-- pour une version déjà sortie).
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.changelog (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  released_at date not null,
  body text not null check (char_length(body) between 1 and 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists changelog_version_key on public.changelog (version);
create index if not exists changelog_released_at_idx on public.changelog (released_at desc);

drop trigger if exists set_changelog_updated_at on public.changelog;
create trigger set_changelog_updated_at
  before update on public.changelog
  for each row execute function public.set_updated_at();

alter table public.changelog enable row level security;

-- Lecture publique (connecté ou invité) des entrées publiées seulement.
drop policy if exists "changelog_select_active" on public.changelog;
create policy "changelog_select_active" on public.changelog
  for select
  using (active = true);

-- Les admins voient aussi les entrées désactivées (brouillon) et sont seuls à pouvoir
-- créer/modifier/supprimer.
drop policy if exists "changelog_select_admin" on public.changelog;
create policy "changelog_select_admin" on public.changelog
  for select
  using (public.is_admin());

drop policy if exists "changelog_insert_admin" on public.changelog;
create policy "changelog_insert_admin" on public.changelog
  for insert
  with check (public.is_admin());

drop policy if exists "changelog_update_admin" on public.changelog;
create policy "changelog_update_admin" on public.changelog
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "changelog_delete_admin" on public.changelog;
create policy "changelog_delete_admin" on public.changelog
  for delete
  using (public.is_admin());
