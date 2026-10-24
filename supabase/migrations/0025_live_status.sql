-- Mode Amis (LOT F2) : statut en direct. Une ligne par utilisateur, mise à jour au
-- démarrage/pause/reprise/fin d'une session et par un battement de cœur régulier côté
-- client (§1 du LOT F2) — une ligne sans mise à jour depuis plus de 2 minutes est
-- considérée hors ligne, calculé à la lecture (list_friends()), jamais stocké comme un
-- état à part : « hors ligne » n'est pas une valeur de `state`, c'est l'absence récente de
-- battement.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.live_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state text not null default 'inactive' check (state in ('focus', 'pause', 'inactive')),
  -- Début de l'état courant (pas forcément de la session entière : repart à chaque
  -- transition focus<->pause<->inactif) et durée prévue du segment en cours, si connue
  -- (reprend directement les mêmes grandeurs que le moteur du minuteur — durationMs).
  started_at timestamptz,
  duration_ms bigint,
  updated_at timestamptz not null default now()
);

alter table public.live_status enable row level security;

-- Visible de soi-même toujours, et des amis acceptés seulement si la personne n'a pas
-- désactivé show_live_status ni activé le mode invisible — appliqué ici, pas seulement
-- côté interface (voir profiles.show_live_status / invisible_mode, migration 0020).
drop policy if exists "live_status_select_self_or_friends" on public.live_status;
create policy "live_status_select_self_or_friends" on public.live_status
  for select
  using (
    auth.uid() = user_id
    or (
      public.are_friends(auth.uid(), user_id)
      and exists (
        select 1 from public.profiles p
        where p.id = user_id and p.show_live_status = true and p.invisible_mode = false
      )
    )
  );

-- Écriture limitée à sa propre ligne, directement par le client (pas de règle métier
-- complexe ici, contrairement à friendships — même principe que timer_state).
drop policy if exists "live_status_insert_own" on public.live_status;
create policy "live_status_insert_own" on public.live_status
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "live_status_update_own" on public.live_status;
create policy "live_status_update_own" on public.live_status
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.live_status to authenticated;
revoke all on public.live_status from anon;

-- Realtime (§ règles transversales) : permet aux amis de recevoir les changements de
-- statut en direct sans interroger en boucle. RLS s'applique aussi aux évènements Realtime
-- (postgres_changes) : un abonné ne reçoit que les lignes que la politique SELECT
-- ci-dessus l'autorise déjà à lire.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_status'
  ) then
    execute 'alter publication supabase_realtime add table public.live_status';
  end if;
end;
$$;

-- list_friends() (migration 0022) étend ses colonnes avec le statut en direct : DROP
-- obligatoire avant de changer la forme d'une fonction RETURNS TABLE (CREATE OR REPLACE
-- ne le permet pas). Le statut d'un ami n'apparaît que si sa vie privée l'autorise (sinon
-- live_state/live_started_at valent NULL et live_is_online vaut false) ; « en ligne » est
-- calculé ici (updated_at de moins de 2 minutes), jamais stocké.
drop function if exists public.list_friends();
create function public.list_friends()
returns table (
  friendship_id uuid,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_version integer,
  since timestamptz,
  live_state text,
  live_started_at timestamptz,
  live_duration_ms bigint,
  live_is_online boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id as friendship_id,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_version,
    f.updated_at as since,
    case when p.show_live_status and not p.invisible_mode then ls.state else null end as live_state,
    case when p.show_live_status and not p.invisible_mode then ls.started_at else null end as live_started_at,
    case when p.show_live_status and not p.invisible_mode then ls.duration_ms else null end as live_duration_ms,
    case
      when p.show_live_status and not p.invisible_mode and ls.updated_at is not null
        then (now() - ls.updated_at) < interval '2 minutes'
      else false
    end as live_is_online
  from public.friendships f
  join public.profiles p
    on p.id = (case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end)
  left join public.live_status ls on ls.user_id = p.id
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    and not public.is_banned(p.id)
  order by p.username asc;
$$;

grant execute on function public.list_friends() to authenticated;
revoke execute on function public.list_friends() from anon;

notify pgrst, 'reload schema';
