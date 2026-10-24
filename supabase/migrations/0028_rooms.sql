-- Mode Amis (LOT F3) : salons de focus ensemble. Un salon réunit l'hôte et des amis
-- invités autour d'un même minuteur synchronisé (une seule session de focus par salon —
-- pas d'enchaînement de pauses dans ce lot, voir docs/AMIS.md). Toute mutation passe par
-- une fonction SECURITY DEFINER (migration 0029) : aucune politique INSERT/UPDATE/DELETE
-- pour le rôle normal, seulement SELECT, même principe que `friendships` (LOT F1).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'running', 'paused', 'ended')),
  focus_minutes integer not null check (focus_minutes between 5 and 120),
  started_at timestamptz,
  duration_ms bigint,
  -- Temps déjà écoulé au moment de la mise en pause (ms) : permet de reprendre en
  -- recalculant started_at = now() - elapsed_ms_at_pause, même principe que le moteur du
  -- minuteur individuel (reste exact quelle que soit la durée de la pause).
  elapsed_ms_at_pause bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.room_participants (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined', 'left', 'abandoned')),
  joined_at timestamptz,
  left_at timestamptz,
  -- Battement de cœur dédié au salon (mis à jour par get_room_state() à chaque appel,
  -- migration 0029) : indépendant du statut en direct du minuteur personnel (LOT F2),
  -- qui ne reflète pas forcément le minuteur partagé du salon. Sert à détecter
  -- l'abandon (silence de plus de 2 minutes pendant que le salon tourne).
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_participants_user_idx on public.room_participants (user_id, status);

drop trigger if exists set_rooms_updated_at on public.rooms;
create trigger set_rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

-- Visible par tout participant du salon, quel que soit son statut (y compris invité pas
-- encore répondu : il doit voir l'hôte et la durée annoncée pour décider).
drop policy if exists "rooms_select_participant" on public.rooms;
create policy "rooms_select_participant" on public.rooms
  for select
  using (
    exists (
      select 1 from public.room_participants rp
      where rp.room_id = rooms.id and rp.user_id = auth.uid()
    )
  );

grant select on public.rooms to authenticated;
revoke all on public.rooms from anon;

alter table public.room_participants enable row level security;

-- Les participants d'un même salon se voient entre eux même sans lien d'amitié direct
-- (réunis par l'hôte, qui est ami avec chacun) — seuls pseudo/nom/avatar sont exposés via
-- get_room_state(), déjà consultables par n'importe qui par pseudo exact (LOT F1,
-- find_profile_preview) : aucune nouvelle fuite de vie privée.
drop policy if exists "room_participants_select_participant" on public.room_participants;
create policy "room_participants_select_participant" on public.room_participants
  for select
  using (
    exists (
      select 1 from public.room_participants rp2
      where rp2.room_id = room_participants.room_id and rp2.user_id = auth.uid()
    )
  );

grant select on public.room_participants to authenticated;
revoke all on public.room_participants from anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_participants'
  ) then
    execute 'alter publication supabase_realtime add table public.room_participants';
  end if;
end;
$$;

notify pgrst, 'reload schema';
