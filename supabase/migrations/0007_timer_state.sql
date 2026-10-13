-- État courant du minuteur, pour reprendre une session sur un autre appareil.
-- Une seule ligne par utilisateur (clé primaire = user_id) : le minuteur en cours est unique.
-- paused_at est une extension du schéma du §15 du cahier des charges, nécessaire pour
-- recalculer correctement le temps restant pendant une pause (voir src/features/timer/engine).
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.timer_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null check (mode in ('pomodoro', 'countdown', 'stopwatch')),
  segment text not null check (segment in ('focus', 'short_break', 'long_break', 'countdown', 'stopwatch')),
  status text not null check (status in ('idle', 'running', 'paused', 'completed')),
  started_at timestamptz,
  paused_at timestamptz,
  duration_ms bigint,
  paused_total_ms bigint not null default 0,
  task_id uuid references public.tasks (id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_timer_state_updated_at on public.timer_state;
create trigger set_timer_state_updated_at
  before update on public.timer_state
  for each row execute function public.set_updated_at();

alter table public.timer_state enable row level security;

drop policy if exists "timer_state_select_own" on public.timer_state;
create policy "timer_state_select_own" on public.timer_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "timer_state_insert_own" on public.timer_state;
create policy "timer_state_insert_own" on public.timer_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "timer_state_update_own" on public.timer_state;
create policy "timer_state_update_own" on public.timer_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "timer_state_delete_own" on public.timer_state;
create policy "timer_state_delete_own" on public.timer_state
  for delete
  using (auth.uid() = user_id);
