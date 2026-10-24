-- Mode Amis (LOT F1) : champs ajoutés à profiles — code ami, version d'avatar (pour
-- contourner le cache d'image après changement de photo), et réglages de vie privée.
-- Tout vit dans profiles plutôt qu'une table séparée : ce sont des préférences 1:1 avec
-- le compte, au même titre que stats_visibility (déjà sur cette table) — et une fonction
-- SECURITY DEFINER (are_friends, is_banned, etc.) peut toujours les lire sans RLS, même
-- si profiles.select reste strictement limité à auth.uid() = id (voir docs/SECURITE.md).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

alter table public.profiles
  add column if not exists friend_code text,
  add column if not exists avatar_version integer not null default 0,
  add column if not exists invisible_mode boolean not null default false,
  add column if not exists show_live_status boolean not null default true,
  add column if not exists show_total_time_score boolean not null default true,
  add column if not exists participate_leaderboard boolean not null default true;

-- Alphabet sans caractères ambigus (0/O, 1/I) — 24 lettres + 8 chiffres = 32 symboles,
-- 32^8 combinaisons : la boucle de génération re-tire en cas de collision (même principe
-- que generate_unique_username(), migration 0009_ensure_profile.sql).
create or replace function public.generate_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Jamais appelée directement par le client : seulement depuis le trigger ci-dessous et
-- depuis regenerate_friend_code(), toutes deux security definer (exécutées avec les
-- droits du propriétaire, donc cette révocation ne les empêche pas de fonctionner).
revoke execute on function public.generate_friend_code() from public, anon, authenticated;

create or replace function public.set_default_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.generate_friend_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_friend_code on public.profiles;
create trigger profiles_set_friend_code
  before insert on public.profiles
  for each row execute function public.set_default_friend_code();

-- Comptes déjà créés avant cette migration : filet de sécurité pour que personne ne se
-- retrouve sans code ami (le trigger ne couvre que les nouvelles inscriptions).
update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;

-- ADD CONSTRAINT n'a pas de IF NOT EXISTS en PostgreSQL : DROP IF EXISTS puis CREATE,
-- comme pour les triggers et politiques RLS ailleurs dans ces migrations, pour rester
-- rejouable sans erreur.
alter table public.profiles drop constraint if exists profiles_friend_code_format;
alter table public.profiles
  add constraint profiles_friend_code_format check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$');
alter table public.profiles drop constraint if exists profiles_friend_code_unique;
alter table public.profiles
  add constraint profiles_friend_code_unique unique (friend_code);

-- friend_code reste une colonne modifiable par le propriétaire via la politique RLS
-- générique profiles_update_own (comme username/display_name/avatar_url) plutôt que
-- verrouillée derrière une RPC exclusive : un choix personnalisé reste conforme au format
-- et à l'unicité (contraintes ci-dessus), et ne donne accès à rien de sensible — seul un
-- ami potentiel qui connaît déjà ce code peut l'utiliser pour envoyer une demande. Ce
-- n'est donc pas une faille, juste une nuance produit (« régénérable » n'implique pas
-- « non personnalisable »).

-- Contourne le cache d'image après upload/suppression d'avatar (le client ajoute
-- ?v=avatar_version à l'URL publique du bucket Storage). Toujours recalculé ici à partir
-- de l'ancienne valeur, jamais pris tel quel depuis la requête du client (même si le
-- client envoie un avatar_version dans son update, il est écrasé) : impossible de le
-- désynchroniser du contenu réel de avatar_url, par erreur ou intentionnellement.
create or replace function public.bump_avatar_version()
returns trigger
language plpgsql
as $$
begin
  new.avatar_version := old.avatar_version + (case when new.avatar_url is distinct from old.avatar_url then 1 else 0 end);
  return new;
end;
$$;

drop trigger if exists profiles_bump_avatar_version on public.profiles;
create trigger profiles_bump_avatar_version
  before update on public.profiles
  for each row execute function public.bump_avatar_version();

-- Régénère son propre code ami (demandé explicitement — ex. code partagé par erreur).
-- current_uid vient uniquement de auth.uid(), jamais d'un paramètre : impossible de
-- changer le code de quelqu'un d'autre (même principe que ensure_profile()).
create or replace function public.regenerate_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  new_code text;
begin
  if current_uid is null then
    raise exception 'regenerate_friend_code() doit être appelé par un utilisateur authentifié';
  end if;
  new_code := public.generate_friend_code();
  update public.profiles set friend_code = new_code where id = current_uid;
  return new_code;
end;
$$;

grant execute on function public.regenerate_friend_code() to authenticated;
revoke execute on function public.regenerate_friend_code() from anon;

notify pgrst, 'reload schema';
