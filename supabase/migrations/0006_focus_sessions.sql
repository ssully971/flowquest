-- Sessions de minuteur enregistrées (base des statistiques et de la série).
-- group_session_id est une colonne réservée, sans clé étrangère pour l'instant : les salles
-- de groupe (V2) et la collection (V4, §13 du cahier des charges) s'y accrocheront plus tard
-- sans recréer ni perdre de session existante.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('focus', 'short_break', 'long_break')),
  planned_seconds integer not null check (planned_seconds >= 0),
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null default false,
  task_id uuid references public.tasks (id) on delete set null,
  group_session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists focus_sessions_user_id_idx on public.focus_sessions (user_id);
create index if not exists focus_sessions_started_at_idx on public.focus_sessions (user_id, started_at desc);

alter table public.focus_sessions enable row level security;

drop policy if exists "focus_sessions_select_own" on public.focus_sessions;
create policy "focus_sessions_select_own" on public.focus_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "focus_sessions_insert_own" on public.focus_sessions;
create policy "focus_sessions_insert_own" on public.focus_sessions
  for insert
  with check (auth.uid() = user_id);

-- Une session s'écrit en deux temps (créée au lancement, complétée à la fin) : la mise à
-- jour reste nécessaire, mais seule la ligne du propriétaire peut être touchée.
drop policy if exists "focus_sessions_update_own" on public.focus_sessions;
create policy "focus_sessions_update_own" on public.focus_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "focus_sessions_delete_own" on public.focus_sessions;
create policy "focus_sessions_delete_own" on public.focus_sessions
  for delete
  using (auth.uid() = user_id);
