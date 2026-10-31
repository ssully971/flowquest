-- 0058 — Constellation : liens entre tâches, positions des nœuds, garde-fou task_id
--
-- La constellation (vue graphe façon Obsidian) relie des TÂCHES entre elles :
--  * task_links : un lien « dépend de » (depends_on, orienté : from dépend de to) ou « lié à »
--    (related, symétrique : stocké une seule fois, dans l'ordre croissant des identifiants) ;
--  * constellation_layouts : positions enregistrées des nœuds, UNE ligne par utilisateur
--    (jsonb : identifiant du nœud → x, y, épinglé) pour ne pas écrire une ligne par nœud à
--    chaque déplacement.
-- Le temps passé sur une tâche vient de focus_sessions.task_id, désormais renseigné par l'app :
-- un garde-fou le remet à NULL si la tâche n'existe pas (encore) côté serveur, pour qu'une
-- session ne soit jamais refusée parce que sa tâche n'a pas été synchronisée.
-- Les séries, le classement et les gels de série ne lisent aucune de ces tables.
-- Idempotente : rejouable sans effet de bord.

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_task_id uuid not null references public.tasks (id) on delete cascade,
  to_task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null check (kind in ('depends_on', 'related')),
  created_at timestamptz not null default now(),
  constraint task_links_no_self check (from_task_id <> to_task_id),
  constraint task_links_unique unique (user_id, from_task_id, to_task_id, kind)
);

create index if not exists task_links_user_id_idx on public.task_links (user_id);
create index if not exists task_links_from_idx on public.task_links (from_task_id);
create index if not exists task_links_to_idx on public.task_links (to_task_id);

-- Les deux tâches doivent appartenir à l'utilisateur ; un lien « related » est canonique
-- (from < to) pour qu'A↔B et B↔A ne puissent pas coexister.
create or replace function public.task_links_guard()
returns trigger
language plpgsql
as $$
begin
  if new.from_task_id = new.to_task_id then
    raise exception 'Une tâche ne peut pas être liée à elle-même.' using errcode = '23514';
  end if;
  if (select count(*) from public.tasks
       where id in (new.from_task_id, new.to_task_id) and user_id = new.user_id) <> 2 then
    raise exception 'Les deux tâches doivent t''appartenir.' using errcode = '42501';
  end if;
  if new.kind = 'related' and new.from_task_id::text > new.to_task_id::text then
    new := row(new.id, new.user_id, new.to_task_id, new.from_task_id, new.kind, new.created_at);
  end if;
  return new;
end;
$$;

drop trigger if exists task_links_guard_trg on public.task_links;
create trigger task_links_guard_trg
  before insert or update on public.task_links
  for each row execute function public.task_links_guard();

alter table public.task_links enable row level security;

drop policy if exists "task_links_select_own" on public.task_links;
create policy "task_links_select_own" on public.task_links
  for select using (auth.uid() = user_id);

drop policy if exists "task_links_insert_own" on public.task_links;
create policy "task_links_insert_own" on public.task_links
  for insert with check (auth.uid() = user_id);

drop policy if exists "task_links_delete_own" on public.task_links;
create policy "task_links_delete_own" on public.task_links
  for delete using (auth.uid() = user_id);

create table if not exists public.constellation_layouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  positions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint constellation_layouts_size check (pg_column_size(positions) < 262144)
);

alter table public.constellation_layouts enable row level security;

drop policy if exists "constellation_layouts_select_own" on public.constellation_layouts;
create policy "constellation_layouts_select_own" on public.constellation_layouts
  for select using (auth.uid() = user_id);

drop policy if exists "constellation_layouts_insert_own" on public.constellation_layouts;
create policy "constellation_layouts_insert_own" on public.constellation_layouts
  for insert with check (auth.uid() = user_id);

drop policy if exists "constellation_layouts_update_own" on public.constellation_layouts;
create policy "constellation_layouts_update_own" on public.constellation_layouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Garde-fou : une session référençant une tâche inconnue du serveur est enregistrée sans tâche.
create or replace function public.focus_sessions_task_guard()
returns trigger
language plpgsql
as $$
begin
  if new.task_id is not null
     and not exists (select 1 from public.tasks where id = new.task_id and user_id = new.user_id) then
    new.task_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists focus_sessions_task_guard_trg on public.focus_sessions;
create trigger focus_sessions_task_guard_trg
  before insert or update of task_id on public.focus_sessions
  for each row execute function public.focus_sessions_task_guard();

notify pgrst, 'reload schema';
