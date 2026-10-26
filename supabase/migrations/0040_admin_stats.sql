-- Panneau Admin refait (lot I2, §2) : Vue d'ensemble. `last_active_at` mesure l'activité
-- réelle (la dernière connexion Supabase Auth est insuffisante avec les sessions PWA
-- persistantes, qui ne se reconnectent jamais). Idempotente : peut être recollée sans
-- erreur dans l'éditeur SQL Supabase.

alter table public.profiles
  add column if not exists last_active_at timestamptz;

create index if not exists profiles_last_active_at_idx on public.profiles (last_active_at);

-- RLS propriétaire déjà en place depuis la migration 0002 (profiles_select_own /
-- profiles_update_own) — une ALTER TABLE n'ajoute pas de nouvelle policy, celles
-- existantes couvrent déjà cette colonne comme toute autre colonne de la ligne.
-- Revalidées ici explicitement pour que cette migration documente elle-même la
-- protection dont hérite cette nouvelle colonne.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

-- Battement d'activité (lot I2, §2) : appelée par le client à intervalles réguliers
-- (voir useActivityHeartbeat côté client) ; no-op silencieux si `last_active_at` a déjà
-- été mis à jour il y a moins d'une heure, pour que l'appel répété côté client reste bon
-- marché, et « au plus une fois par heure » soit garanti ici, pas seulement par la
-- cadence choisie côté client.
create or replace function public.touch_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    return;
  end if;

  update public.profiles
  set last_active_at = now()
  where id = current_uid
    and (last_active_at is null or last_active_at < now() - interval '1 hour');
end;
$$;

grant execute on function public.touch_activity() to authenticated;
revoke execute on function public.touch_activity() from anon;

-- Statistiques globales (lot I2, §2), réservées aux admins. Renvoie un seul objet jsonb
-- plutôt que plusieurs colonnes : plus simple à consommer côté client (un seul appel,
-- un seul type de retour), et plus facile à faire évoluer sans casser la signature.
-- `stable` (lit sans modifier), security definer pour contourner RLS proprement (un
-- admin doit voir les agrégats de tout le monde, pas seulement sa propre ligne).
create or replace function public.admin_stats_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total_signups integer;
  dau integer;
  wau integer;
  mau integer;
  impact_hours numeric;
  signups_per_day jsonb;
  retention_d1 numeric;
  retention_d7 numeric;
  pillar_distribution jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_stats_overview() réservé aux administrateurs';
  end if;

  select count(*) into total_signups from auth.users;

  select count(*) into dau from public.profiles pr where pr.last_active_at >= now() - interval '1 day';
  select count(*) into wau from public.profiles pr where pr.last_active_at >= now() - interval '7 days';
  select count(*) into mau from public.profiles pr where pr.last_active_at >= now() - interval '30 days';

  -- « Compteur d'impact » (lot I2, §2) : somme de toutes les secondes de focus de la
  -- communauté depuis le début, pas seulement les sessions menées à terme (le temps
  -- réellement passé en concentration compte, même si la session a été arrêtée tôt).
  select coalesce(sum(fs.actual_seconds), 0) / 3600.0 into impact_hours
  from public.focus_sessions fs
  where fs.kind = 'focus';

  select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'count', coalesce(c.signup_count, 0)) order by d.day), '[]'::jsonb)
  into signups_per_day
  from generate_series((current_date - interval '29 days')::date, current_date, interval '1 day') as d(day)
  left join (
    select date_trunc('day', au.created_at)::date as day, count(*) as signup_count
    from auth.users au
    where au.created_at >= current_date - interval '29 days'
    group by 1
  ) c on c.day = d.day;

  -- Rétention « simple » (lot I2, §2) : proportion des comptes assez anciens dont la
  -- dernière activité connue est survenue au moins N jours après l'inscription. Ce n'est
  -- pas une vraie cohorte « revenu précisément au jour N » — `last_active_at` ne garde
  -- que la DERNIÈRE activité, pas un historique complet — mais une mesure directionnelle
  -- raisonnable, honnêtement simplifiée comme demandé.
  select case
    when count(*) filter (where au.created_at <= now() - interval '1 day') = 0 then null
    else round(
      100.0 * count(*) filter (
        where au.created_at <= now() - interval '1 day'
          and pr.last_active_at >= au.created_at + interval '1 day'
      ) / count(*) filter (where au.created_at <= now() - interval '1 day'),
      1
    )
  end into retention_d1
  from auth.users au join public.profiles pr on pr.id = au.id;

  select case
    when count(*) filter (where au.created_at <= now() - interval '7 days') = 0 then null
    else round(
      100.0 * count(*) filter (
        where au.created_at <= now() - interval '7 days'
          and pr.last_active_at >= au.created_at + interval '7 days'
      ) / count(*) filter (where au.created_at <= now() - interval '7 days'),
      1
    )
  end into retention_d7
  from auth.users au join public.profiles pr on pr.id = au.id;

  -- Distribution des piliers (lot I2, §2) : agrégée par nom normalisé (minuscule, espaces
  -- de bord retirés) — un pilier est un nom libre, donc une donnée potentiellement
  -- identifiante si elle était affichée brute par petit groupe. Seuls les noms utilisés
  -- par au moins 3 utilisateurs distincts apparaissent individuellement, le reste est
  -- regroupé dans « Autres ».
  with normalized as (
    select lower(trim(pl.name)) as norm_name, pl.user_id
    from public.pillars pl
    where pl.archived_at is null
  ),
  counted as (
    select norm_name, count(distinct user_id) as user_count
    from normalized
    group by norm_name
  ),
  bucketed as (
    select norm_name, user_count from counted where user_count >= 3
    union all
    select 'Autres', coalesce(sum(user_count), 0)
    from counted
    where user_count < 3
    having coalesce(sum(user_count), 0) > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', norm_name, 'count', user_count) order by user_count desc), '[]'::jsonb)
  into pillar_distribution
  from bucketed;

  return jsonb_build_object(
    'totalSignups', total_signups,
    'dau', dau,
    'wau', wau,
    'mau', mau,
    'impactHours', round(impact_hours, 1),
    'signupsPerDay', signups_per_day,
    'retentionD1', retention_d1,
    'retentionD7', retention_d7,
    'pillarDistribution', pillar_distribution
  );
end;
$$;

grant execute on function public.admin_stats_overview() to authenticated;
revoke execute on function public.admin_stats_overview() from anon;

notify pgrst, 'reload schema';
