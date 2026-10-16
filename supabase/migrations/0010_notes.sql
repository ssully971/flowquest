-- Bloc-notes rapide (une note par utilisateur, §8 et §15 du cahier des charges).
-- updated_at n'est PAS auto-rempli par un trigger ici (même raison que
-- user_settings/timer_state, voir 0004 et 0007) : le client l'envoie lui-même à chaque
-- écriture, pour que la résolution de conflit "dernier horodatage gagne" (trigger
-- reject_stale_write, défini en 0008) compare le moment de la modification locale, pas
-- l'heure d'arrivée sur le serveur.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own" on public.notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own" on public.notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own" on public.notes
  for delete
  using (auth.uid() = user_id);

drop trigger if exists notes_reject_stale_write on public.notes;
create trigger notes_reject_stale_write
  before update on public.notes
  for each row execute function public.reject_stale_write();
