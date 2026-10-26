-- Cadeaux d'XP (LOT I3, §6, « Offrir de l'XP ») : l'admin attribue une quantité d'XP
-- plafonnée à un pilier précis d'un utilisateur, avec un motif obligatoire. recompute_pillar_xp()
-- (redéfinie dans 0045_game_campaigns.sql) additionne déjà la somme des cadeaux d'un
-- pilier à son XP dérivé des sessions — cette migration crée la table qu'elle interroge,
-- et le déclencheur qui la recalcule à chaque nouveau cadeau.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.xp_grants (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  pillar_id uuid not null references public.pillars (id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 1000),
  reason text not null check (char_length(trim(reason)) between 1 and 200),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index if not exists xp_grants_target_user_id_idx on public.xp_grants (target_user_id);
create index if not exists xp_grants_pillar_id_idx on public.xp_grants (pillar_id);

alter table public.xp_grants enable row level security;

-- Le bénéficiaire peut lire ses propres cadeaux (pour afficher le message "🎁 Tu as
-- reçu...", motif inclus) ; aucune politique insert/update/delete côté client — tout
-- passe par admin_grant_xp() et acknowledge_xp_grant() ci-dessous, même principe que
-- feature_flags/admin_log.
drop policy if exists "xp_grants_select_own" on public.xp_grants;
create policy "xp_grants_select_own" on public.xp_grants
  for select
  using (auth.uid() = target_user_id);

grant select on public.xp_grants to authenticated;

-- Sélecteur « pilier au choix » de l'interface « Offrir de l'XP » : juste de quoi
-- peupler un menu (id, nom), jamais les statistiques — admin_user_stats() (0043) reste la
-- seule voie journalisée pour consulter l'activité d'un utilisateur ; ici, l'admin choisit
-- seulement une cible, il ne consulte rien.
create or replace function public.admin_list_user_pillars(p_target_user_id uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name
  from public.pillars p
  where public.is_admin() and p.user_id = p_target_user_id and p.archived_at is null
  order by p.name;
$$;

grant execute on function public.admin_list_user_pillars(uuid) to authenticated;
revoke execute on function public.admin_list_user_pillars(uuid) from anon;

create or replace function public.admin_grant_xp(
  p_target_user_id uuid,
  p_pillar_id uuid,
  p_amount integer,
  p_reason text
)
returns public.xp_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.xp_grants;
begin
  if not public.is_admin() then
    raise exception 'admin_grant_xp() réservé aux administrateurs';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000 then
    raise exception 'La quantité d''XP doit être comprise entre 1 et 1000';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Le motif est obligatoire';
  end if;
  if not exists (
    select 1 from public.pillars where id = p_pillar_id and user_id = p_target_user_id
  ) then
    raise exception 'Ce pilier n''appartient pas à cet utilisateur';
  end if;

  insert into public.xp_grants (target_user_id, pillar_id, amount, reason, granted_by)
  values (p_target_user_id, p_pillar_id, p_amount, trim(p_reason), auth.uid())
  returning * into result;

  insert into public.admin_log (admin_id, action, target)
  values (
    auth.uid(),
    'grant_xp',
    p_target_user_id::text || ' — ' || p_amount::text || ' XP — ' || trim(p_reason)
  );

  return result;
end;
$$;

-- Marque un cadeau comme vu (affiché une seule fois côté interface) — réservé au
-- bénéficiaire lui-même, jamais à un autre utilisateur ni même à l'admin qui l'a offert.
create or replace function public.acknowledge_xp_grant(p_grant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'acknowledge_xp_grant() doit être appelé par un utilisateur authentifié';
  end if;

  update public.xp_grants
  set seen_at = now()
  where id = p_grant_id and target_user_id = current_uid and seen_at is null;
end;
$$;

grant execute on function public.admin_grant_xp(uuid, uuid, integer, text) to authenticated;
grant execute on function public.acknowledge_xp_grant(uuid) to authenticated;
revoke execute on function public.admin_grant_xp(uuid, uuid, integer, text) from anon;
revoke execute on function public.acknowledge_xp_grant(uuid) from anon;

create or replace function public.xp_grants_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_pillar_xp(new.pillar_id);
  return new;
end;
$$;

drop trigger if exists xp_grants_recompute on public.xp_grants;
create trigger xp_grants_recompute
  after insert on public.xp_grants
  for each row
  execute function public.xp_grants_recompute();

notify pgrst, 'reload schema';
