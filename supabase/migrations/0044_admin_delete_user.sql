-- Suppression « nucléaire » d'un compte à la demande d'un admin (LOT I3, §5 — demande
-- RGPD). Réutilise exactement le mécanisme de delete_own_account() (0013_delete_account.sql) :
-- supprimer la ligne auth.users suffit, TOUTES les tables possédées par l'utilisateur
-- (profiles, user_settings, tasks, focus_sessions, timer_state, notes, pillars,
-- friendships, cheers, rooms/room_participants, duo_streaks, live_status, xp_grants —
-- cf. migrations respectives) ont une clé étrangère "on delete cascade" vers auth.users
-- (directement ou via profiles, qui cascade lui-même). Seule la photo dans le bucket
-- `avatars` n'a pas de clé étrangère (Storage n'en a pas vers auth.users) et doit donc
-- être supprimée explicitement — même extrait que admin_remove_avatar()
-- (0024_avatars_storage.sql).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.admin_delete_user(p_target_user_id uuid, p_confirm_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_username text;
begin
  if not public.is_admin() then
    raise exception 'admin_delete_user() réservé aux administrateurs';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'Impossible de supprimer son propre compte depuis cet écran';
  end if;

  select username into target_username from public.profiles where id = p_target_user_id;
  if target_username is null then
    raise exception 'Compte introuvable';
  end if;
  if exists (select 1 from public.profiles where id = p_target_user_id and role = 'admin') then
    raise exception 'Impossible de supprimer un autre administrateur';
  end if;
  -- Double confirmation : le pseudo exact doit être retapé (comparaison stricte,
  -- sensible à la casse — jamais un simple "oui" qui s'actionnerait trop facilement).
  if p_confirm_username is null or p_confirm_username <> target_username then
    raise exception 'Le pseudo saisi ne correspond pas à celui du compte à supprimer';
  end if;

  delete from storage.objects
  where bucket_id = 'avatars'
    and name in (p_target_user_id::text || '/avatar.webp', p_target_user_id::text || '/avatar.jpg');

  -- Journalisé AVANT la suppression : admin_log.admin_id référence auth.users, mais la
  -- ligne cible, elle, n'existera plus pour vérifier quoi que ce soit après coup — seul
  -- l'identifiant (jamais le pseudo ni aucune autre donnée personnelle) est conservé.
  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'delete_user', p_target_user_id::text);

  delete from auth.users where id = p_target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid, text) to authenticated;
revoke execute on function public.admin_delete_user(uuid, text) from anon;

notify pgrst, 'reload schema';
