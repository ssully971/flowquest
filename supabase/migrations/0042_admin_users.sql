-- Visionneuse d'utilisateurs et modération (LOT I3, §1-2) : liste paginée/triable/
-- cherchable des comptes (pseudo + e-mail, ce dernier lu dans auth.users par une fonction
-- SECURITY DEFINER réservée aux admins — RLS n'exposerait jamais un e-mail d'un autre
-- utilisateur), suspension temporaire (1/7/30 jours) qui réutilise is_banned() et donc
-- TOUTES les politiques/RPC qui en dépendent déjà (amis, salons, encouragements,
-- classement...), sans avoir à les toucher une par une. Bannir/débannir/retirer la photo
-- existent déjà (0019_moderation.sql, 0024_avatars_storage.sql) : seule la suspension est
-- neuve ici.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

alter table public.profiles
  add column if not exists suspended_until timestamptz;

-- is_banned() (0019_moderation.sql) gouverne déjà la quasi-totalité des RPC et politiques
-- sociales (amis, salons, encouragements, classement, séries à deux...) : y ajouter la
-- suspension temporaire suffit à la faire respecter PARTOUT, sans modifier un seul de ces
-- appelants. Un compte suspendu redevient automatiquement actif à l'expiration — aucune
-- tâche planifiée requise, la comparaison à now() se refait à chaque appel.
create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select banned_at is not null or (suspended_until is not null and suspended_until > now())
      from public.profiles
      where id = uid
    ),
    false
  );
$$;

grant execute on function public.is_banned(uuid) to authenticated, anon;

-- Suspend un compte pour une durée fixe (1, 7 ou 30 jours) — jamais une date arbitraire
-- fournie par le client, pour éviter une suspension de durée infinie ou négative par
-- erreur d'interface. Réutilise admin_log comme toute action admin (§12).
create or replace function public.admin_suspend_user(
  p_target_user_id uuid,
  p_duration_days integer,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_suspend_user() réservé aux administrateurs';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'Impossible de se suspendre soi-même';
  end if;
  if p_duration_days not in (1, 7, 30) then
    raise exception 'Durée de suspension invalide : 1, 7 ou 30 jours uniquement';
  end if;
  if exists (select 1 from public.profiles where id = p_target_user_id and role = 'admin') then
    raise exception 'Impossible de suspendre un autre administrateur';
  end if;

  update public.profiles
  set suspended_until = now() + make_interval(days => p_duration_days)
  where id = p_target_user_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;

  insert into public.admin_log (admin_id, action, target)
  values (
    auth.uid(),
    'suspend_user',
    p_target_user_id::text || ' — ' || p_duration_days::text || 'j'
      || coalesce(' — ' || nullif(trim(p_reason), ''), '')
  );
end;
$$;

create or replace function public.admin_unsuspend_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_unsuspend_user() réservé aux administrateurs';
  end if;

  update public.profiles set suspended_until = null where id = p_target_user_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;

  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'unsuspend_user', p_target_user_id::text);
end;
$$;

grant execute on function public.admin_suspend_user(uuid, integer, text) to authenticated;
grant execute on function public.admin_unsuspend_user(uuid) to authenticated;
revoke execute on function public.admin_suspend_user(uuid, integer, text) from anon;
revoke execute on function public.admin_unsuspend_user(uuid) from anon;

-- Liste paginée/cherchable/triable des comptes, avec l'e-mail (lu dans auth.users,
-- normalement invisible côté client — RLS sur profiles ne porte que sur sa propre ligne).
-- total_count (window function) évite une seconde requête de comptage côté client pour
-- la pagination. p_sort : un seul des quatre CASE est non nul à la fois (le choisi),
-- les trois autres sont NULL et donc ignorés par ORDER BY (NULLS LAST) — created_at desc
-- en dernier recours stabilise l'ordre.
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
  total_count bigint
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
    pr.id,
    u.email,
    pr.username,
    pr.display_name,
    pr.created_at,
    pr.last_active_at,
    pr.role,
    case
      when pr.banned_at is not null then 'banned'
      when pr.suspended_until is not null and pr.suspended_until > now() then 'suspended'
      else 'active'
    end as status,
    pr.marketing_consent,
    count(*) over () as total_count
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where
    p_search is null
    or trim(p_search) = ''
    or pr.username ilike '%' || p_search || '%'
    or u.email ilike '%' || p_search || '%'
  order by
    case when p_sort = 'username_asc' then pr.username end asc nulls last,
    case when p_sort = 'created_at_asc' then pr.created_at end asc nulls last,
    case when p_sort = 'last_active_desc' then pr.last_active_at end desc nulls last,
    pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

grant execute on function public.admin_list_users(integer, integer, text, text) to authenticated;
revoke execute on function public.admin_list_users(integer, integer, text, text) from anon;

-- Export CSV (§4) : mêmes colonnes que la liste, sans pagination (plafonnée à 10 000
-- lignes par prudence) — le tri/la recherche n'ont pas de sens pour un export complet.
-- p_only_consented (vrai par défaut) ne renvoie que les comptes ayant explicitement
-- consenti à recevoir des e-mails marketing ; le mode "tous les comptes" reste réservé
-- aux e-mails de service par l'avertissement affiché côté interface, jamais appliqué ici
-- (la fonction ne connaît pas l'intention de l'appelant, seulement le filtre demandé).
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
  select u.email, pr.username, pr.created_at, pr.last_active_at, pr.marketing_consent
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where not p_only_consented or pr.marketing_consent
  order by pr.created_at desc
  limit 10000;
end;
$$;

grant execute on function public.admin_export_users(boolean) to authenticated;
revoke execute on function public.admin_export_users(boolean) from anon;

notify pgrst, 'reload schema';
