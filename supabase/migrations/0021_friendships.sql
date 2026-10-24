-- Mode Amis (LOT F1) : relations d'amitié (demande, acceptation, refus, retrait, blocage).
-- Toute mutation passe par une fonction SECURITY DEFINER qui vérifie auth.uid() et les
-- règles métier (quota, unicité, blocage) — jamais par une écriture directe depuis le
-- client, même authentifié : la table n'a donc aucune politique INSERT/UPDATE/DELETE pour
-- le rôle normal, seulement SELECT (voir plus bas).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  -- Qui a bloqué, distinct de requester_id/addressee_id qui ne décrivent que la direction
  -- de la demande d'origine (un ami accepté de longue date peut bloquer l'autre, auquel
  -- cas blocked_by n'est ni forcément le requester ni forcément l'addressee d'origine).
  blocked_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_blocked_by_party check (
    blocked_by is null or blocked_by in (requester_id, addressee_id)
  )
);

-- Unicité de la paire quel que soit le sens (A→B et B→A sont la même relation) : colonnes
-- générées least/greatest, uniques ensemble. Sert aussi de cible à ON CONFLICT pour
-- block_user() plus bas.
alter table public.friendships
  add column if not exists user_low uuid generated always as (least(requester_id, addressee_id)) stored,
  add column if not exists user_high uuid generated always as (greatest(requester_id, addressee_id)) stored;

create unique index if not exists friendships_pair_unique on public.friendships (user_low, user_high);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
  for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Pas de politique INSERT/UPDATE/DELETE : toute mutation passe par les fonctions
-- SECURITY DEFINER ci-dessous, qui appliquent les règles métier (quota, blocage,
-- comptes bannis) avant d'écrire.

-- Brique réutilisée par les futures politiques RLS (statut en direct, classement — LOT
-- F2+) : amitié acceptée ET aucune des deux parties bannie. Centraliser cette vérification
-- ici garantit qu'un compte banni « n'apparaît nulle part » (règle transversale du Mode
-- Amis) partout où are_friends() sert de garde, sans le répéter dans chaque politique.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where user_low = least(a, b) and user_high = greatest(a, b) and status = 'accepted'
  )
  and not public.is_banned(a)
  and not public.is_banned(b);
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
revoke execute on function public.are_friends(uuid, uuid) from anon;

-- Envoie une demande par code ami OU par pseudo exact (jamais les deux, jamais une
-- recherche partielle — évite l'énumération des comptes). Si l'autre personne a déjà
-- envoyé une demande dans l'autre sens, celle-ci est acceptée directement plutôt que de
-- créer deux demandes croisées.
create or replace function public.send_friend_request(p_code text default null, p_username text default null)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  target_id uuid;
  existing public.friendships;
  result public.friendships;
  daily_count integer;
begin
  if current_uid is null then
    raise exception 'send_friend_request() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if (nullif(trim(coalesce(p_code, '')), '') is null) = (nullif(trim(coalesce(p_username, '')), '') is null) then
    raise exception 'Fournis soit un code ami, soit un pseudo (jamais les deux)';
  end if;

  if p_code is not null then
    select id into target_id from public.profiles where friend_code = upper(trim(p_code));
  else
    select id into target_id from public.profiles where username = lower(trim(p_username));
  end if;

  if target_id is null or public.is_banned(target_id) then
    raise exception 'Compte introuvable';
  end if;
  if target_id = current_uid then
    raise exception 'Impossible de s’ajouter soi-même';
  end if;

  select count(*) into daily_count
  from public.friendships
  where requester_id = current_uid and created_at >= now() - interval '1 day';
  if daily_count >= 20 then
    raise exception 'Trop de demandes envoyées aujourd’hui (limite : 20). Réessaie demain.';
  end if;

  select * into existing
  from public.friendships
  where user_low = least(current_uid, target_id) and user_high = greatest(current_uid, target_id);

  if existing.id is not null then
    if existing.status = 'accepted' then
      raise exception 'Vous êtes déjà amis';
    elsif existing.status = 'blocked' then
      if existing.blocked_by = target_id then
        raise exception 'Compte introuvable';
      else
        raise exception 'Débloque d’abord ce compte avant de lui envoyer une demande';
      end if;
    elsif existing.status = 'pending' then
      if existing.requester_id = current_uid then
        raise exception 'Demande déjà envoyée';
      else
        -- L'autre personne t'avait déjà envoyé une demande : on l'accepte directement.
        update public.friendships set status = 'accepted' where id = existing.id
        returning * into result;
        return result;
      end if;
    end if;
  end if;

  begin
    insert into public.friendships (requester_id, addressee_id, status)
    values (current_uid, target_id, 'pending')
    returning * into result;
  exception when unique_violation then
    -- Double clic / requête concurrente : renvoie la ligne déjà créée par l'autre appel.
    select * into result
    from public.friendships
    where user_low = least(current_uid, target_id) and user_high = greatest(current_uid, target_id);
  end;

  return result;
end;
$$;

-- L'addressee répond à une demande reçue : acceptée (statut mis à jour) ou refusée (ligne
-- supprimée, pour permettre une nouvelle demande plus tard sans ligne résiduelle).
create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  target_row public.friendships;
begin
  if current_uid is null then
    raise exception 'respond_friend_request() doit être appelé par un utilisateur authentifié';
  end if;

  select * into target_row from public.friendships
  where id = p_friendship_id and addressee_id = current_uid and status = 'pending';
  if target_row.id is null then
    raise exception 'Demande introuvable';
  end if;

  if p_accept then
    update public.friendships set status = 'accepted' where id = p_friendship_id;
  else
    delete from public.friendships where id = p_friendship_id;
  end if;
end;
$$;

-- Le demandeur annule sa propre demande en attente (plutôt qu'attendre un refus).
create or replace function public.cancel_friend_request(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'cancel_friend_request() doit être appelé par un utilisateur authentifié';
  end if;

  delete from public.friendships
  where id = p_friendship_id and requester_id = current_uid and status = 'pending';
  if not found then
    raise exception 'Demande introuvable';
  end if;
end;
$$;

-- Retrait d'ami : les deux parties peuvent y mettre fin.
create or replace function public.remove_friend(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'remove_friend() doit être appelé par un utilisateur authentifié';
  end if;

  delete from public.friendships
  where user_low = least(current_uid, p_other_user_id)
    and user_high = greatest(current_uid, p_other_user_id)
    and status = 'accepted';
  if not found then
    raise exception 'Vous n’êtes pas amis avec ce compte';
  end if;
end;
$$;

-- Bloque un compte (ami, demande en attente, ou personne totalement nouvelle) : upsert
-- sur l'index unique de la paire. Un bloqué ne peut plus renvoyer de demande tant que le
-- blocage n'est pas levé par celui qui l'a posé (unblock_user()).
create or replace function public.block_user(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'block_user() doit être appelé par un utilisateur authentifié';
  end if;
  if p_other_user_id = current_uid then
    raise exception 'Impossible de se bloquer soi-même';
  end if;

  insert into public.friendships (requester_id, addressee_id, status, blocked_by)
  values (current_uid, p_other_user_id, 'blocked', current_uid)
  on conflict (user_low, user_high)
  do update set status = 'blocked', blocked_by = current_uid, updated_at = now();
end;
$$;

create or replace function public.unblock_user(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'unblock_user() doit être appelé par un utilisateur authentifié';
  end if;

  delete from public.friendships
  where user_low = least(current_uid, p_other_user_id)
    and user_high = greatest(current_uid, p_other_user_id)
    and status = 'blocked'
    and blocked_by = current_uid;
  if not found then
    raise exception 'Ce compte n’est pas bloqué par toi';
  end if;
end;
$$;

grant select on public.friendships to authenticated;
grant execute on function public.send_friend_request(text, text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
revoke all on public.friendships from anon;
revoke execute on function public.send_friend_request(text, text) from anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from anon;
revoke execute on function public.cancel_friend_request(uuid) from anon;
revoke execute on function public.remove_friend(uuid) from anon;
revoke execute on function public.block_user(uuid) from anon;
revoke execute on function public.unblock_user(uuid) from anon;

notify pgrst, 'reload schema';
