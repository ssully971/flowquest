-- LOT 3 (Admin) — « aucun compte affiché » : correctif de admin_list_users / admin_export_users et
-- réparation des comptes sans ligne profiles. Idempotente : recollable sans erreur.
--
-- CAUSE (reproduite sur un Postgres local dont auth.users.email est un varchar(255), comme sur
-- Supabase) : 0042 renvoyait `u.email` (varchar(255)) dans une colonne OUT `email text` via
-- RETURN QUERY. PL/pgSQL refuse cette conversion implicite à l'EXÉCUTION (la création de la
-- fonction passe sans erreur) :
--   ERROR: structure of query does not match function result type
--   DETAIL: Returned type character varying(255) does not match expected type text in column 2.
-- Le client avalait l'erreur (« return error || !data ? [] »), d'où une liste vide indiscernable
-- d'un échec. Correctif : `u.email::text`.
--
-- ÉVOLUTIONS :
--  1. admin_list_users part de auth.users avec LEFT JOIN profiles : un compte sans ligne profiles
--     (créé avant le trigger de création automatique, ou orphelin) apparaît, marqué
--     profile_missing = true. Pagination, recherche (pseudo ou e-mail) et tri conservés.
--  2. admin_export_users : même correctif de type (et les comptes sans profil sortent en mode
--     « tous les comptes », jamais en mode « consentis » : sans profil, pas de consentement).
--  3. admin_repair_profile(uid) : crée la ligne profiles manquante d'un compte (équivalent admin de
--     ensure_profile(), qui ne répare que l'appelant), journalisé dans admin_log.

-- ─── 1. Liste des comptes ───────────────────────────────────────────────────
drop function if exists public.admin_list_users(integer, integer, text, text);

create or replace function public.admin_list_users(
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null,
  p_sort text default 'created_at_desc'
)
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  created_at timestamptz,
  last_active_at timestamptz,
  role text,
  status text,
  marketing_consent boolean,
  total_count bigint,
  profile_missing boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_list_users() réservé aux administrateurs';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(pr.username, split_part(coalesce(u.email, ''), '@', 1))::text,
    pr.display_name::text,
    coalesce(pr.created_at, u.created_at),
    pr.last_active_at,
    coalesce(pr.role, 'user')::text,
    (case
      when pr.banned_at is not null then 'banned'
      when pr.suspended_until is not null and pr.suspended_until > now() then 'suspended'
      else 'active'
    end)::text as status,
    coalesce(pr.marketing_consent, false),
    count(*) over () as total_count,
    (pr.id is null) as profile_missing
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where
    p_search is null
    or trim(p_search) = ''
    or pr.username ilike '%' || p_search || '%'
    or u.email ilike '%' || p_search || '%'
  order by
    case when p_sort = 'username_asc' then coalesce(pr.username, split_part(coalesce(u.email, ''), '@', 1)) end asc nulls last,
    case when p_sort = 'created_at_asc' then coalesce(pr.created_at, u.created_at) end asc nulls last,
    case when p_sort = 'last_active_desc' then pr.last_active_at end desc nulls last,
    coalesce(pr.created_at, u.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_users(integer, integer, text, text) to authenticated;
revoke execute on function public.admin_list_users(integer, integer, text, text) from anon;

-- ─── 2. Export CSV ──────────────────────────────────────────────────────────
create or replace function public.admin_export_users(p_only_consented boolean default true)
returns table (
  email text,
  username text,
  created_at timestamptz,
  last_active_at timestamptz,
  marketing_consent boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_export_users() réservé aux administrateurs';
  end if;

  return query
  select
    u.email::text,
    coalesce(pr.username, split_part(coalesce(u.email, ''), '@', 1))::text,
    coalesce(pr.created_at, u.created_at),
    pr.last_active_at,
    coalesce(pr.marketing_consent, false)
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where not p_only_consented or coalesce(pr.marketing_consent, false)
  order by coalesce(pr.created_at, u.created_at) desc
  limit 10000;
end;
$$;

grant execute on function public.admin_export_users(boolean) to authenticated;
revoke execute on function public.admin_export_users(boolean) from anon;

-- ─── 3. Réparation d'un profil manquant ─────────────────────────────────────
-- Même logique que handle_new_user / ensure_profile, pour le compte ciblé : pseudo unique dérivé
-- des métadonnées ou de l'e-mail, consentement marketing lu dans les métadonnées. invite_ok reste à
-- sa valeur par défaut (true) : un compte déjà existant n'est jamais mis « en attente » de code.
create or replace function public.admin_repair_profile(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account auth.users;
  consented boolean;
begin
  if not public.is_admin() then
    raise exception 'admin_repair_profile() réservé aux administrateurs';
  end if;

  select * into account from auth.users where id = p_target_user_id;
  if account.id is null then
    raise exception 'Compte introuvable';
  end if;

  -- Déjà un profil (double clic, réparé entre-temps) : rien à faire.
  if exists (select 1 from public.profiles where id = p_target_user_id) then
    return p_target_user_id;
  end if;

  consented := coalesce((account.raw_user_meta_data ->> 'marketing_consent')::boolean, false);

  insert into public.profiles (id, username, display_name, marketing_consent, marketing_consent_at)
  values (
    account.id,
    public.generate_unique_username(
      coalesce(account.raw_user_meta_data ->> 'username', split_part(coalesce(account.email, 'joueur'), '@', 1))
    ),
    coalesce(account.raw_user_meta_data ->> 'display_name', account.raw_user_meta_data ->> 'username'),
    consented,
    case when consented then now() else null end
  )
  on conflict (id) do nothing;

  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'repair_profile', p_target_user_id::text);

  return p_target_user_id;
end;
$$;

grant execute on function public.admin_repair_profile(uuid) to authenticated;
revoke execute on function public.admin_repair_profile(uuid) from anon, public;

notify pgrst, 'reload schema';
