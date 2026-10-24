-- Infrastructure de modération (LOT F1, Mode Amis) : is_banned() est présupposée exister
-- par les règles transversales du Mode Amis (« les comptes bannis n'apparaissent nulle
-- part et ne peuvent rien faire »), mais n'existait pas encore dans le schéma — cette
-- migration la crée, avec le strict minimum pour qu'elle soit réellement actionnable
-- (sans quoi elle serait toujours fausse et la règle resterait lettre morte). Même
-- construction que is_admin() (migration 0003_is_admin.sql).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

alter table public.profiles
  add column if not exists banned_at timestamptz;

create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select banned_at is not null from public.profiles where id = uid),
    false
  );
$$;

grant execute on function public.is_banned(uuid) to authenticated, anon;

-- Bannir/débannir reste une action admin, journalisée comme toute autre (§12 : « Les
-- modifications admin sont journalisées »). target_user_id vient toujours d'un paramètre
-- explicite (jamais de auth.uid()) : c'est le but même de ces deux fonctions, réservées
-- aux admins par la vérification is_admin() en première ligne.
create or replace function public.admin_ban_user(p_target_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_ban_user() réservé aux administrateurs';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'Impossible de se bannir soi-même';
  end if;

  update public.profiles set banned_at = now() where id = p_target_user_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;

  insert into public.admin_log (admin_id, action, target)
  values (
    auth.uid(),
    'ban_user',
    p_target_user_id::text || coalesce(' — ' || nullif(trim(p_reason), ''), '')
  );
end;
$$;

create or replace function public.admin_unban_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_unban_user() réservé aux administrateurs';
  end if;

  update public.profiles set banned_at = null where id = p_target_user_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;

  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'unban_user', p_target_user_id::text);
end;
$$;

grant execute on function public.admin_ban_user(uuid, text) to authenticated;
grant execute on function public.admin_unban_user(uuid) to authenticated;
revoke execute on function public.admin_ban_user(uuid, text) from anon;
revoke execute on function public.admin_unban_user(uuid) from anon;

notify pgrst, 'reload schema';
