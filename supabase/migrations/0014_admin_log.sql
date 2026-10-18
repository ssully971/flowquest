-- Journal des actions admin (§12 : « Les modifications admin sont journalisées — qui, quoi,
-- quand »). Table d'audit pure : on y écrit à chaque mutation admin (citation créée, nouveauté
-- modifiée, message support traité...), on ne la modifie ni ne la supprime jamais depuis le client.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.admin_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_log_created_at_idx on public.admin_log (created_at desc);

alter table public.admin_log enable row level security;

-- Seuls les admins peuvent lire le journal. L'écriture est elle aussi réservée aux admins
-- (jamais au rôle anon/authenticated générique) : un utilisateur normal n'a aucune raison
-- d'y insérer une ligne, et l'app ne doit journaliser que ses propres actions admin.
drop policy if exists "admin_log_select_admin" on public.admin_log;
create policy "admin_log_select_admin" on public.admin_log
  for select
  using (public.is_admin());

drop policy if exists "admin_log_insert_admin" on public.admin_log;
create policy "admin_log_insert_admin" on public.admin_log
  for insert
  with check (public.is_admin() and admin_id = auth.uid());

-- Pas de politique UPDATE/DELETE : un journal d'audit ne se corrige ni ne s'efface depuis
-- le client, même par un admin.
