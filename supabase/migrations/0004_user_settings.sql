-- Réglages utilisateur (thèmes, horloge, minuteur, extras...), stockés en JSON versionné
-- pour pouvoir migrer le format sans casser les clients plus anciens.
-- updated_at n'est PAS auto-rempli par un trigger ici (contrairement à profiles/tasks) :
-- le client l'envoie lui-même à chaque écriture, pour que la résolution de conflit
-- "dernier horodatage gagne" (migration 0008) compare le moment de la modification
-- locale, pas l'heure d'arrivée sur le serveur.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version integer not null default 1,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own" on public.user_settings
  for delete
  using (auth.uid() = user_id);
