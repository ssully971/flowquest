-- BÊTA FERMÉE (lots 1 et 3) : seules les personnes munies d'un code d'invitation à usage
-- unique peuvent créer un compte. Les comptes existants ne sont PAS concernés (colonne
-- profiles.invite_ok backfillée à true par `default true`). Deux sources de codes :
-- l'admin (12 h) et les utilisateurs « méritants » (parrainage : 7 jours d'ancienneté,
-- 10 h de focus réel, 2 codes par mois calendaire, validité 7 jours).
--
-- Principe de sécurité : TOUTE règle métier vit ici, côté SQL. Le client n'a aucun accès
-- en écriture à invite_codes (aucune politique insert/update/delete) ; tout passe par des
-- fonctions SECURITY DEFINER à search_path verrouillé (patterns 0018/0030/0039/0044).
--
-- Garde d'inscription (option A du cahier des charges, voir docs/BETA_FERMEE.md) :
-- handle_new_user() (trigger AFTER INSERT sur auth.users) valide ET consomme le code dans
-- la MÊME transaction que la création du compte. Une exception l'annule en bloc : si la
-- création échoue le code n'est pas brûlé ; deux inscriptions simultanées avec le même
-- code → un seul UPDATE ... WHERE is_used = false réussit (le second attend le verrou de
-- ligne puis ne trouve plus de ligne).
--   - inscription e-mail : le code arrive dans options.data.invite_code ; refusé sans code
--     valide ;
--   - nouveau compte Google (OAuth / ID token) : pas de code possible avant le retour
--     OAuth → le compte est créé « en attente » (profiles.invite_ok = false, traité comme
--     banni par is_banned() donc bloqué sur tout le social + écran bloquant côté client)
--     jusqu'à consume_invite_code(). Les comptes en attente > 24 h sont purgés par
--     purge_pending_invite_accounts().
-- Interrupteur : drapeau feature_flags « beta_fermee » (activé par défaut) ; coupé, les
-- inscriptions publiques rouvrent sans redéployer.
--
-- Tous les seuils vivent dans invite_setting() (un seul endroit à modifier).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Seuils : UN SEUL endroit (create or replace pour les modifier plus tard)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.invite_setting(p_key text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_key
    when 'focus_required_seconds'    then 36000  -- 10 h de focus réel cumulé
    when 'account_age_required_days' then 7
    when 'monthly_limit'             then 2      -- codes « user » par mois calendaire
    when 'user_code_ttl_hours'       then 168    -- 7 jours
    when 'admin_code_ttl_hours'      then 12
    when 'check_max_attempts'        then 10     -- vérifications de code par fenêtre
    when 'check_window_minutes'      then 10
    when 'pending_account_ttl_hours' then 24     -- purge des comptes Google sans code
  end;
$$;

revoke all on function public.invite_setting(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  -- 6 à 8 caractères, alphabet sans 0/O/1/I/L (ambigus).
  code text not null unique
    constraint invite_codes_code_format check (code ~ '^[A-HJKMNP-Z2-9]{6,8}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('admin', 'user')),
  is_used boolean not null default false,
  -- on delete set null : si l'invité supprime son compte, is_used reste true.
  used_by uuid null references auth.users (id) on delete set null,
  used_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint invite_codes_used_coherent check (
    (is_used and used_at is not null)
    or (not is_used and used_by is null and used_at is null)
  )
);

create index if not exists invite_codes_creator_idx
  on public.invite_codes (created_by, type, created_at);
create index if not exists invite_codes_code_idx on public.invite_codes (code);

alter table public.invite_codes enable row level security;

drop policy if exists "invite_codes_select_own" on public.invite_codes;
create policy "invite_codes_select_own" on public.invite_codes
  for select to authenticated
  using (created_by = auth.uid());

drop policy if exists "invite_codes_select_admin" on public.invite_codes;
create policy "invite_codes_select_admin" on public.invite_codes
  for select to authenticated
  using (public.is_admin());

-- Aucune politique insert/update/delete. Les privilèges par défaut (0018) accordent tout
-- à authenticated : on les retire explicitement.
revoke all on public.invite_codes from anon, authenticated;
grant select on public.invite_codes to authenticated;

-- Tentatives de vérification de code (limitation de débit). Clé = empreinte SHA-256 de
-- l'IP (jamais l'IP en clair) ou id utilisateur. Aucun accès client.
create table if not exists public.invite_code_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists invite_code_attempts_key_idx
  on public.invite_code_attempts (key, attempted_at);
create index if not exists invite_code_attempts_at_idx
  on public.invite_code_attempts (attempted_at);

alter table public.invite_code_attempts enable row level security;
revoke all on public.invite_code_attempts from anon, authenticated;

alter table public.profiles add column if not exists invite_ok boolean not null default true;

-- Seul le serveur (fonctions ci-dessous, qui posent le réglage local interne) peut changer
-- invite_ok : jamais le client, même sur sa propre ligne (cf. profiles_prevent_role_change).
create or replace function public.protect_profile_invite_ok()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invite_ok is distinct from old.invite_ok
     and auth.uid() is not null
     and coalesce(current_setting('flowquest.invite_internal', true), '') <> 'on' then
    raise exception 'invite_ok ne peut pas être modifié depuis le client';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_invite_ok on public.profiles;
create trigger profiles_protect_invite_ok
  before update on public.profiles
  for each row execute function public.protect_profile_invite_ok();

-- Un compte en attente de code est traité comme banni par TOUTES les RPC sociales qui
-- s'appuient sur is_banned() (corps de 0042 + invite_ok).
create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select banned_at is not null
        or (suspended_until is not null and suspended_until > now())
        or not invite_ok
      from public.profiles
      where id = uid
    ),
    false
  );
$$;

grant execute on function public.is_banned(uuid) to authenticated, anon;

-- Interrupteur (activé par défaut ; ne jamais écraser un choix déjà fait).
insert into public.feature_flags (key, enabled, label, description) values
  ('beta_fermee', true, 'Bêta fermée', 'Inscription sur invitation uniquement (code à usage unique). Coupe-le pour rouvrir les inscriptions publiques.')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fonctions internes (aucun accès client)
-- ─────────────────────────────────────────────────────────────────────────────

-- Code aléatoire cryptographique (gen_random_bytes, jamais random()). Rejet des octets
-- >= 248 pour éviter le biais du modulo (31 symboles : 248 = 8 × 31).
create or replace function public._gen_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  bytes bytea;
  b integer;
  i integer;
begin
  while length(result) < 8 loop
    bytes := extensions.gen_random_bytes(32);
    for i in 0..31 loop
      b := get_byte(bytes, i);
      if b < 248 then
        result := result || substr(alphabet, (b % 31) + 1, 1);
        exit when length(result) = 8;
      end if;
    end loop;
  end loop;
  return result;
end;
$$;

revoke all on function public._gen_invite_code() from public, anon, authenticated;

-- Insère un code (réessaie en cas de collision, quasi impossible : 31^8).
create or replace function public._create_invite_code(p_user uuid, p_type text, p_ttl_hours integer)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt integer := 0;
begin
  loop
    attempt := attempt + 1;
    begin
      return query
        insert into public.invite_codes as ic (code, created_by, type, expires_at)
        values (public._gen_invite_code(), p_user, p_type, now() + make_interval(hours => p_ttl_hours))
        returning ic.code, ic.expires_at;
      return;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

revoke all on function public._create_invite_code(uuid, text, integer) from public, anon, authenticated;

-- Consommation atomique : un seul UPDATE conditionnel. Sous concurrence, le second appel
-- attend le verrou de ligne, réévalue is_used = false et ne trouve plus rien.
create or replace function public._consume_invite_code(p_code text, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed_id uuid;
begin
  if p_code is null or btrim(p_code) = '' then
    return false;
  end if;
  update public.invite_codes ic
  set is_used = true, used_by = p_user, used_at = now()
  where ic.code = upper(btrim(p_code))
    and ic.is_used = false
    and (ic.expires_at is null or ic.expires_at > now())
  returning ic.id into consumed_id;
  return consumed_id is not null;
end;
$$;

revoke all on function public._consume_invite_code(text, uuid) from public, anon, authenticated;

-- Limitation de débit : au plus check_max_attempts essais par fenêtre et par clé. Le
-- message d'erreur est le même quel que soit le code testé.
create or replace function public._invite_throttle(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  delete from public.invite_code_attempts where attempted_at < now() - interval '1 day';
  select count(*) into recent
  from public.invite_code_attempts a
  where a.key = p_key
    and a.attempted_at > now() - make_interval(mins => public.invite_setting('check_window_minutes'));
  if recent >= public.invite_setting('check_max_attempts') then
    raise exception 'too_many_attempts';
  end if;
  insert into public.invite_code_attempts (key) values (p_key);
end;
$$;

revoke all on function public._invite_throttle(text) from public, anon, authenticated;

-- Début du mois calendaire courant, fuseau de la Guadeloupe.
create or replace function public._invite_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('month', now() at time zone 'America/Guadeloupe') at time zone 'America/Guadeloupe';
$$;

revoke all on function public._invite_month_start() from public, anon, authenticated;

-- Focus RÉEL cumulé, calculé depuis focus_sessions (jamais une valeur client) : sessions
-- de focus terminées, durée plafonnée au temps réel écoulé (ended_at - started_at).
create or replace function public._invite_focus_seconds(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(least(
    fs.actual_seconds,
    greatest(0, extract(epoch from (fs.ended_at - fs.started_at))::integer)
  )), 0)::bigint
  from public.focus_sessions fs
  where fs.user_id = p_user and fs.kind = 'focus' and fs.ended_at is not null;
$$;

revoke all on function public._invite_focus_seconds(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fonctions publiques
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_generate_invite_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  new_expiry timestamptz;
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_generate_invite_code() réservé aux administrateurs';
  end if;

  select c.code, c.expires_at into new_code, new_expiry
  from public._create_invite_code(auth.uid(), 'admin', public.invite_setting('admin_code_ttl_hours')) c;

  select ic.id into new_id from public.invite_codes ic where ic.code = new_code;
  -- Journalisé par identifiant : le code lui-même est un secret.
  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'invite.generate', new_id::text);

  return query select new_code, new_expiry;
end;
$$;

create or replace function public.admin_revoke_invite_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_revoke_invite_code() réservé aux administrateurs';
  end if;
  -- Révoquer = faire expirer maintenant (jamais supprimer : l'historique reste).
  update public.invite_codes ic
  set expires_at = now()
  where ic.id = p_id and ic.is_used = false
    and (ic.expires_at is null or ic.expires_at > now());
  if not found then
    raise exception 'Code introuvable ou déjà utilisé/expiré';
  end if;
  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'invite.revoke', p_id::text);
end;
$$;

create or replace function public.admin_list_invite_codes(p_limit integer default 50)
returns table (
  id uuid, code text, type text, created_at timestamptz, expires_at timestamptz,
  is_used boolean, used_at timestamptz, used_by_username text, status text
)
language sql
stable
security definer
set search_path = public
as $$
  select ic.id, ic.code, ic.type, ic.created_at, ic.expires_at, ic.is_used, ic.used_at,
         p.username,
         case when ic.is_used then 'used'
              when ic.expires_at is not null and ic.expires_at <= now() then 'expired'
              else 'active' end
  from public.invite_codes ic
  left join public.profiles p on p.id = ic.used_by
  where public.is_admin() and ic.type = 'admin'
  order by ic.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create or replace function public.get_invite_eligibility()
returns table (
  focus_seconds bigint,
  focus_required_seconds integer,
  account_age_days integer,
  account_age_required_days integer,
  codes_this_month integer,
  codes_monthly_limit integer,
  next_reset_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  created timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select u.created_at into created from auth.users u where u.id = uid;
  return query select
    public._invite_focus_seconds(uid),
    public.invite_setting('focus_required_seconds'),
    floor(extract(epoch from (now() - created)) / 86400)::integer,
    public.invite_setting('account_age_required_days'),
    (select count(*)::integer from public.invite_codes ic
       where ic.created_by = uid and ic.type = 'user' and ic.created_at >= public._invite_month_start()),
    public.invite_setting('monthly_limit'),
    (date_trunc('month', now() at time zone 'America/Guadeloupe') + interval '1 month')
      at time zone 'America/Guadeloupe';
end;
$$;

-- Erreurs typées (message = clé, traduite par l'interface) : not_authenticated,
-- account_unavailable, account_too_young, not_enough_focus, monthly_limit_reached.
create or replace function public.user_generate_invite_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  created timestamptz;
  created_this_month integer;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if public.is_banned(uid) then
    raise exception 'account_unavailable';
  end if;

  -- Verrou par utilisateur, tenu jusqu'à la fin de la transaction : deux appels
  -- simultanés sont sérialisés, le second voit le code du premier dans son décompte.
  perform pg_advisory_xact_lock(hashtextextended('invite_generate:' || uid::text, 0));

  select u.created_at into created from auth.users u where u.id = uid;
  if created > now() - make_interval(days => public.invite_setting('account_age_required_days')) then
    raise exception 'account_too_young';
  end if;

  if public._invite_focus_seconds(uid) < public.invite_setting('focus_required_seconds') then
    raise exception 'not_enough_focus';
  end if;

  select count(*) into created_this_month
  from public.invite_codes ic
  where ic.created_by = uid and ic.type = 'user' and ic.created_at >= public._invite_month_start();
  if created_this_month >= public.invite_setting('monthly_limit') then
    raise exception 'monthly_limit_reached';
  end if;

  return query
    select c.code, c.expires_at
    from public._create_invite_code(uid, 'user', public.invite_setting('user_code_ttl_hours')) c;
end;
$$;

create or replace function public.list_my_invite_codes()
returns table (
  id uuid, code text, created_at timestamptz, expires_at timestamptz,
  is_used boolean, used_at timestamptz, used_by_username text, status text
)
language sql
stable
security definer
set search_path = public
as $$
  select ic.id, ic.code, ic.created_at, ic.expires_at, ic.is_used, ic.used_at, p.username,
         case when ic.is_used then 'used'
              when ic.expires_at is not null and ic.expires_at <= now() then 'expired'
              else 'active' end
  from public.invite_codes ic
  left join public.profiles p on p.id = ic.used_by
  where ic.created_by = auth.uid() and ic.type = 'user'
  order by ic.created_at desc
  limit 100;
$$;

-- Appelable par anon : booléen valide/invalide, rien d'autre (identique pour code
-- inexistant, utilisé ou expiré). Limité par empreinte d'IP. Indice UX uniquement : la
-- vraie garde est handle_new_user().
create or replace function public.check_invite_code(p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  xff text[] := string_to_array(coalesce(headers ->> 'x-forwarded-for', ''), ',');
  client_ip text := coalesce(
    nullif(btrim(headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(headers ->> 'x-real-ip'), ''),
    nullif(btrim(xff[cardinality(xff)]), ''),
    'unknown'
  );
begin
  perform public._invite_throttle(
    case when auth.uid() is not null then 'u:' || auth.uid()::text
         else 'ip:' || encode(extensions.digest(client_ip, 'sha256'), 'hex') end
  );
  return exists (
    select 1 from public.invite_codes ic
    where ic.code = upper(btrim(coalesce(p_code, '')))
      and ic.is_used = false
      and (ic.expires_at is null or ic.expires_at > now())
  );
end;
$$;

-- Nouveau compte Google : saisit son code après le retour OAuth. Idempotent pour un compte
-- déjà actif (renvoie true sans rien consommer). Renvoie false pour un code invalide
-- (tentative comptée, donc limitée), lève too_many_attempts au-delà de la limite.
create or replace function public.consume_invite_code(p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pending boolean;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select not p.invite_ok into pending from public.profiles p where p.id = uid;
  if pending is null then
    raise exception 'account_unavailable';
  end if;
  if not pending then
    return true;
  end if;

  perform public._invite_throttle('u:' || uid::text);

  -- Même transaction : code consommé ET compte activé, ou rien.
  if not public._consume_invite_code(p_code, uid) then
    return false;
  end if;
  perform set_config('flowquest.invite_internal', 'on', true);
  update public.profiles set invite_ok = true where id = uid;
  perform set_config('flowquest.invite_internal', 'off', true);
  return true;
end;
$$;

-- Purge des comptes Google restés sans code (cascade sur toutes les tables, comme
-- admin_delete_user). Réservée à postgres / pg_cron : aucun grant client.
create or replace function public.purge_pending_invite_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  with doomed as (
    select p.id from public.profiles p
    join auth.users u on u.id = p.id
    where not p.invite_ok
      and u.created_at < now() - make_interval(hours => public.invite_setting('pending_account_ttl_hours'))
  ), gone as (
    delete from auth.users where id in (select id from doomed) returning 1
  )
  select count(*) into purged from gone;
  return purged;
end;
$$;

revoke all on function public.purge_pending_invite_accounts() from public, anon, authenticated;

-- Planification horaire si pg_cron est activé (Database > Extensions) ; sinon sans effet.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('flowquest_purge_pending_invites', '17 * * * *',
      'select public.purge_pending_invite_accounts()');
  end if;
exception when others then
  raise notice 'pg_cron non planifié : %', sqlerrm;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Garde d'inscription : handle_new_user() (corps de 0039 + bêta fermée)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consented boolean := coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false);
  -- raw_app_meta_data est posé par le serveur Auth, pas modifiable par le client.
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  account_active boolean := true;
begin
  if not public.is_feature_enabled('signups') then
    raise exception 'Les inscriptions sont temporairement fermées';
  end if;

  if public.is_feature_enabled('beta_fermee') then
    if provider = 'email' then
      -- Message volontairement unique : jamais de détail sur la raison du refus.
      if not public._consume_invite_code(new.raw_user_meta_data ->> 'invite_code', new.id) then
        raise exception 'invite_code_invalid';
      end if;
    else
      -- Google & co : compte créé mais inactif tant qu'aucun code n'est consommé.
      account_active := false;
    end if;
  end if;

  insert into public.profiles (id, username, display_name, marketing_consent, marketing_consent_at, invite_ok)
  values (
    new.id,
    public.generate_unique_username(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'),
    consented,
    case when consented then now() else null end,
    account_active
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Droits d'exécution explicites
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.admin_generate_invite_code() from public, anon;
revoke all on function public.admin_revoke_invite_code(uuid) from public, anon;
revoke all on function public.admin_list_invite_codes(integer) from public, anon;
revoke all on function public.get_invite_eligibility() from public, anon;
revoke all on function public.user_generate_invite_code() from public, anon;
revoke all on function public.list_my_invite_codes() from public, anon;
revoke all on function public.consume_invite_code(text) from public, anon;
revoke all on function public.check_invite_code(text) from public;

grant execute on function public.admin_generate_invite_code() to authenticated;
grant execute on function public.admin_revoke_invite_code(uuid) to authenticated;
grant execute on function public.admin_list_invite_codes(integer) to authenticated;
grant execute on function public.get_invite_eligibility() to authenticated;
grant execute on function public.user_generate_invite_code() to authenticated;
grant execute on function public.list_my_invite_codes() to authenticated;
grant execute on function public.consume_invite_code(text) to authenticated;
grant execute on function public.check_invite_code(text) to anon, authenticated;

notify pgrst, 'reload schema';
