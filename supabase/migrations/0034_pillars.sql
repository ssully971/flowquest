-- Piliers de Vie (LOT G3) : chaque session de focus peut être rattachée à un pilier
-- (Travail, Sport, Études…) ; son XP et son niveau se dérivent du temps RÉEL de focus
-- enregistré (actual_seconds), jamais recalculés depuis un compteur local — toujours
-- recomposés ici, côté serveur, à partir des lignes de focus_sessions.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.pillars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null,
  current_xp integer not null default 0 check (current_xp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists pillars_user_id_idx on public.pillars (user_id);

alter table public.pillars enable row level security;

drop policy if exists "pillars_select_own" on public.pillars;
create policy "pillars_select_own" on public.pillars
  for select
  using (auth.uid() = user_id);

drop policy if exists "pillars_insert_own" on public.pillars;
create policy "pillars_insert_own" on public.pillars
  for insert
  with check (auth.uid() = user_id);

-- current_xp/level ne sont en pratique jamais écrits par le client (voir
-- src/features/pillars/storage/supabase-pillar-sync.ts, qui les omet volontairement de
-- sa charge utile) : seule recompute_pillar_xp() ci-dessous les modifie. RLS ne
-- restreint pas par colonne ; ce choix de confiance est documenté dans le lot G3.
drop policy if exists "pillars_update_own" on public.pillars;
create policy "pillars_update_own" on public.pillars
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pillars_delete_own" on public.pillars;
create policy "pillars_delete_own" on public.pillars
  for delete
  using (auth.uid() = user_id);

-- Maximum 8 piliers ACTIFS par utilisateur (archiver un pilier libère une place) —
-- vérifié aussi côté client (UX immédiate), cette contrainte est le filet de sécurité.
create or replace function public.pillars_enforce_max_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
begin
  if new.archived_at is not null then
    return new;
  end if;

  select count(*) into active_count
  from public.pillars
  where user_id = new.user_id and archived_at is null and id <> new.id;

  if active_count >= 8 then
    raise exception 'Maximum 8 piliers actifs par utilisateur';
  end if;

  return new;
end;
$$;

drop trigger if exists pillars_enforce_max_active on public.pillars;
create trigger pillars_enforce_max_active
  before insert or update on public.pillars
  for each row
  execute function public.pillars_enforce_max_active();

grant select, insert, update, delete on public.pillars to authenticated;

-- Rattachement (optionnel) d'une session à un pilier.
alter table public.focus_sessions
  add column if not exists pillar_id uuid references public.pillars (id) on delete set null;

create index if not exists focus_sessions_pillar_id_idx on public.focus_sessions (pillar_id);

-- Empêche qu'une session ne référence le pilier d'un AUTRE utilisateur (la clé étrangère
-- seule ne vérifie que l'existence de la ligne, pas son propriétaire).
create or replace function public.focus_sessions_pillar_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pillar_id is not null then
    if not exists (
      select 1 from public.pillars where id = new.pillar_id and user_id = new.user_id
    ) then
      raise exception 'pillar_id ne correspond à aucun pilier appartenant à cet utilisateur';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists focus_sessions_pillar_guard on public.focus_sessions;
create trigger focus_sessions_pillar_guard
  before insert or update on public.focus_sessions
  for each row
  execute function public.focus_sessions_pillar_guard();

-- 1 min de focus réel = 10 XP (floor, jamais arrondi au-dessus). Courbe de niveau
-- croissante : passer du niveau L à L+1 coûte 600·(L+1) XP, donc le total cumulé pour
-- atteindre le niveau L (depuis le niveau 1, 0 XP) vaut 300·(L-1)·L — d'où la forme
-- fermée ci-dessous (résolution de 300·(L-1)·L <= xp).
create or replace function public.pillar_level_for_xp(xp integer)
returns integer
language sql
immutable
as $$
  select greatest(1, floor((1 + sqrt(1 + (2.0 * xp) / 150.0)) / 2))::integer;
$$;

grant execute on function public.pillar_level_for_xp(integer) to authenticated, anon;

-- Recompose entièrement current_xp/level d'un pilier à partir de la somme de ses
-- sessions de focus enregistrées : idempotent par construction (une somme ne double
-- jamais compte une session déjà présente, même rejouée via le même upsert).
create or replace function public.recompute_pillar_xp(p_pillar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_xp integer;
begin
  select coalesce(floor(sum(actual_seconds) * 10.0 / 60.0), 0)::integer
  into total_xp
  from public.focus_sessions
  where pillar_id = p_pillar_id and kind = 'focus';

  update public.pillars
  set current_xp = total_xp,
      level = public.pillar_level_for_xp(total_xp)
  where id = p_pillar_id;
end;
$$;

grant execute on function public.recompute_pillar_xp(uuid) to authenticated;

create or replace function public.focus_sessions_pillar_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.pillar_id is not null and old.kind = 'focus' then
      perform public.recompute_pillar_xp(old.pillar_id);
    end if;
    return old;
  end if;

  if new.pillar_id is not null and new.kind = 'focus' then
    perform public.recompute_pillar_xp(new.pillar_id);
  end if;

  if tg_op = 'UPDATE'
     and old.kind = 'focus'
     and old.pillar_id is not null
     and old.pillar_id is distinct from new.pillar_id
  then
    perform public.recompute_pillar_xp(old.pillar_id);
  end if;

  return new;
end;
$$;

drop trigger if exists focus_sessions_pillar_recompute on public.focus_sessions;
create trigger focus_sessions_pillar_recompute
  after insert or update or delete on public.focus_sessions
  for each row
  execute function public.focus_sessions_pillar_recompute();

notify pgrst, 'reload schema';
