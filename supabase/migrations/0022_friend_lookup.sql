-- Mode Amis (LOT F1) : lectures à champs restreints pour les amis/demandes, sans jamais
-- élargir la politique RLS de profiles elle-même (qui reste strictement auth.uid() = id,
-- voir docs/SECURITE.md — « quand les fonctionnalités sociales arriveront, une fonction
-- dédiée sera ajoutée, jamais en assouplissant cette politique »). Même approche que
-- is_username_available() (migration 0012) : une fonction SECURITY DEFINER qui ne renvoie
-- que des colonnes publiques, jamais un accès large à la table.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

-- Aperçu avant envoi d'une demande (« Vous allez ajouter @pseudo ») : recherche EXACTE
-- uniquement (code ou pseudo, jamais une recherche partielle), comptes bannis exclus,
-- impossible de se prévisualiser soi-même.
create or replace function public.find_profile_preview(p_code text default null, p_username text default null)
returns table (id uuid, username text, display_name text, avatar_url text, avatar_version integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'find_profile_preview() doit être appelé par un utilisateur authentifié';
  end if;
  if (nullif(trim(coalesce(p_code, '')), '') is null) = (nullif(trim(coalesce(p_username, '')), '') is null) then
    raise exception 'Fournis soit un code ami, soit un pseudo (jamais les deux)';
  end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.avatar_version
  from public.profiles p
  where
    (
      (p_code is not null and p.friend_code = upper(trim(p_code)))
      or (p_username is not null and p.username = lower(trim(p_username)))
    )
    and p.id <> current_uid
    and not public.is_banned(p.id)
    -- Cohérent avec send_friend_request() : si cette personne t'a bloqué, l'aperçu doit
    -- échouer comme l'envoi échouerait (« Compte introuvable »), jamais la révéler puis
    -- laisser l'envoi échouer juste après — ce décalage serait lui-même un indice de blocage.
    and not exists (
      select 1 from public.friendships f
      where f.user_low = least(current_uid, p.id) and f.user_high = greatest(current_uid, p.id)
        and f.status = 'blocked' and f.blocked_by = p.id
    );
end;
$$;

-- Liste des amis acceptés (comptes bannis exclus — « n'apparaissent nulle part »).
create or replace function public.list_friends()
returns table (
  friendship_id uuid,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_version integer,
  since timestamptz
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
    f.updated_at as since
  from public.friendships f
  join public.profiles p
    on p.id = (case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end)
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    and not public.is_banned(p.id)
  order by p.username asc;
$$;

-- Demandes reçues ET envoyées, en attente (le client distingue via `direction`).
create or replace function public.list_friend_requests()
returns table (
  friendship_id uuid,
  direction text,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_version integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id as friendship_id,
    case when f.addressee_id = auth.uid() then 'incoming' else 'outgoing' end as direction,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.avatar_version,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = (case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end)
  where f.status = 'pending'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    and not public.is_banned(p.id)
  order by f.created_at desc;
$$;

grant execute on function public.find_profile_preview(text, text) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_friend_requests() to authenticated;
revoke execute on function public.find_profile_preview(text, text) from anon;
revoke execute on function public.list_friends() from anon;
revoke execute on function public.list_friend_requests() from anon;

notify pgrst, 'reload schema';
