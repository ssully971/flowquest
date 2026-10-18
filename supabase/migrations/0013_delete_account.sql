-- Suppression de compte, à la demande de l'utilisateur. Supprime la ligne auth.users :
-- toutes les tables liées (profiles, user_settings, tasks, focus_sessions, timer_state,
-- notes) ont une clé étrangère "on delete cascade" vers auth.users (ou vers profiles, qui
-- cascade lui-même), donc tout disparaît en une seule suppression, sans étape manuelle par
-- table. current_uid vient uniquement de auth.uid(), jamais d'un paramètre fourni par le
-- client : impossible de supprimer le compte de quelqu'un d'autre, même en cas de bug côté
-- interface. security definer est nécessaire ici : un utilisateur authentifié n'a normalement
-- pas le droit de supprimer une ligne de auth.users (schéma géré par Supabase) ; cette
-- fonction, exécutée avec les droits de son propriétaire (postgres, celui qui colle la
-- migration dans l'éditeur SQL Supabase), est le seul chemin autorisé.
-- Idempotente : peut être recollée sans erreur.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'delete_own_account() doit être appelé par un utilisateur authentifié';
  end if;

  delete from auth.users where id = current_uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
