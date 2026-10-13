-- Réglages utilisateur (thèmes, horloge, minuteur, extras...), stockés en JSON versionné
-- pour pouvoir migrer le format sans casser les clients plus anciens.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version integer not null default 1,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

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
