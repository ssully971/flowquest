-- Maître du jeu — campagnes XP (LOT I3, §6) : une seule campagne active à la fois
-- (admin_start_campaign désactive toute campagne active avant d'en créer une nouvelle).
-- Le multiplicateur est capturé sur CHAQUE session de focus au moment de sa création
-- (trigger ci-dessous, colonne focus_sessions.xp_multiplier) et jamais recalculé après
-- coup : recompute_pillar_xp() ne fait que ressommer les valeurs déjà enregistrées par
-- ligne, donc modifier ou arrêter une campagne plus tard ne change jamais l'XP déjà
-- accordé (relancer la migration ne change rien non plus — idempotent par construction,
-- comme le reste du système d'XP depuis 0034_pillars.sql).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.game_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  xp_multiplier numeric not null check (xp_multiplier > 0 and xp_multiplier <= 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists game_campaigns_active_idx on public.game_campaigns (active);

alter table public.game_campaigns enable row level security;

-- Pas de politique directe (select/insert/update) pour authenticated/anon : la lecture
-- "campagne en cours" passe par current_game_campaign() ci-dessous (ne révèle que le
-- strict nécessaire à l'affichage du bandeau, jamais l'historique complet), la gestion
-- admin par les RPC dédiées — même principe que feature_flags (0039) et admin_log (0014).

-- Lue par n'importe quel compte connecté (et les invités, via anon) pour afficher le
-- bandeau Double XP : ne renvoie que la campagne active ET actuellement dans sa fenêtre
-- de dates (une campagne "active" mais pas encore commencée ou déjà finie ne compte pas).
create or replace function public.current_game_campaign()
returns table (name text, xp_multiplier numeric, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select name, xp_multiplier, ends_at
  from public.game_campaigns
  where active and now() between starts_at and ends_at
  order by created_at desc
  limit 1;
$$;

grant execute on function public.current_game_campaign() to authenticated, anon;

create or replace function public.admin_list_campaigns()
returns setof public.game_campaigns
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.game_campaigns
  where public.is_admin()
  order by created_at desc;
$$;

grant execute on function public.admin_list_campaigns() to authenticated;
revoke execute on function public.admin_list_campaigns() from anon;

create or replace function public.admin_start_campaign(
  p_name text,
  p_xp_multiplier numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.game_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.game_campaigns;
begin
  if not public.is_admin() then
    raise exception 'admin_start_campaign() réservé aux administrateurs';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'La date de fin doit être postérieure à la date de début';
  end if;

  -- Une seule campagne active à la fois : toute campagne encore marquée active est
  -- désactivée avant que la nouvelle ne soit créée.
  update public.game_campaigns set active = false where active;

  insert into public.game_campaigns (name, xp_multiplier, starts_at, ends_at, active, created_by)
  values (p_name, p_xp_multiplier, p_starts_at, p_ends_at, true, auth.uid())
  returning * into result;

  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'start_campaign', result.id::text || ' — ' || result.name || ' ×' || result.xp_multiplier::text);

  return result;
end;
$$;

create or replace function public.admin_stop_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_stop_campaign() réservé aux administrateurs';
  end if;

  update public.game_campaigns set active = false where id = p_campaign_id;
  if not found then
    raise exception 'Campagne introuvable';
  end if;

  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'stop_campaign', p_campaign_id::text);
end;
$$;

grant execute on function public.admin_start_campaign(text, numeric, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_stop_campaign(uuid) to authenticated;
revoke execute on function public.admin_start_campaign(text, numeric, timestamptz, timestamptz) from anon;
revoke execute on function public.admin_stop_campaign(uuid) from anon;

-- Capture du multiplicateur par session (jamais modifiable ensuite : aucun déclencheur
-- ne s'exécute sur UPDATE, seulement sur INSERT — une session déjà créée garde pour
-- toujours le multiplicateur qu'elle avait à sa création).
alter table public.focus_sessions
  add column if not exists xp_multiplier numeric not null default 1 check (xp_multiplier > 0);

create or replace function public.focus_sessions_capture_xp_multiplier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_multiplier numeric;
begin
  if new.kind = 'focus' then
    select xp_multiplier into current_multiplier from public.current_game_campaign();
    new.xp_multiplier := coalesce(current_multiplier, 1);
  else
    new.xp_multiplier := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists focus_sessions_capture_xp_multiplier on public.focus_sessions;
create trigger focus_sessions_capture_xp_multiplier
  before insert on public.focus_sessions
  for each row
  execute function public.focus_sessions_capture_xp_multiplier();

-- recompute_pillar_xp() (0034_pillars.sql) resomme désormais actual_seconds * xp_multiplier
-- au lieu de actual_seconds seul : la ligne garde son multiplicateur figé pour toujours,
-- donc ce recalcul reste idempotent et jamais rétroactif (modifier/arrêter une campagne
-- après coup n'affecte aucune session déjà enregistrée). Ajoute aussi les cadeaux d'XP
-- (xp_grants, 0046_xp_grants.sql) — la table n'existe pas encore à ce stade de la
-- migration, donc la référence est protégée par un test d'existence (to_regclass) pour
-- que ce fichier reste rejouable isolément avant que 0046 n'existe.
create or replace function public.recompute_pillar_xp(p_pillar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_xp integer;
  grant_xp integer;
  total_xp integer;
begin
  select coalesce(floor(sum(actual_seconds * xp_multiplier) * 10.0 / 60.0), 0)::integer
  into session_xp
  from public.focus_sessions
  where pillar_id = p_pillar_id and kind = 'focus';

  grant_xp := 0;
  if to_regclass('public.xp_grants') is not null then
    execute 'select coalesce(sum(amount), 0)::integer from public.xp_grants where pillar_id = $1'
      into grant_xp
      using p_pillar_id;
  end if;

  total_xp := session_xp + grant_xp;

  update public.pillars
  set current_xp = total_xp,
      level = public.pillar_level_for_xp(total_xp)
  where id = p_pillar_id;
end;
$$;

notify pgrst, 'reload schema';
