-- Mode Amis (LOT F1) : bucket Storage pour les photos de profil. Chemin fixe par
-- utilisateur ({uid}/avatar.webp) — le contournement du cache se fait via ?v=avatar_version
-- dans l'URL (colonne profiles.avatar_version, migration 0020), jamais en changeant le nom
-- de fichier. Lecture publique (URL directe, hors RLS — voir plus bas), mais NON listable :
-- seul le propriétaire peut lister/consulter les métadonnées de SON propre dossier via
-- l'API Storage authentifiée.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 102400, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Important : bucket `public = true` sert les fichiers par URL directe
-- (/storage/v1/object/public/avatars/...) SANS passer par RLS — c'est ce qui donne la
-- « lecture publique » demandée. Les politiques RLS ci-dessous gouvernent l'API Storage
-- authentifiée (list/get/upload/update/delete), pas cette URL publique : avec une
-- politique SELECT restreinte à son propre dossier, personne ne peut lister tout le
-- bucket (list() sur `avatars` ou sur le dossier d'un autre renvoie vide), même si
-- n'importe qui peut récupérer UN fichier précis s'il en connaît déjà l'URL exacte.

drop policy if exists "avatars_select_own_folder" on storage.objects;
create policy "avatars_select_own_folder" on storage.objects
  for select
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder" on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Retire la photo d'un utilisateur (admin) : déréférence profiles.avatar_url (le client
-- bascule alors sur l'avatar par défaut) ET supprime le fichier du bucket, pour une
-- suppression complète plutôt qu'un simple lien cassé. Journalisée comme toute action
-- admin (§12).
create or replace function public.admin_remove_avatar(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_remove_avatar() réservé aux administrateurs';
  end if;

  update public.profiles set avatar_url = null where id = p_target_user_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;

  delete from storage.objects
  where bucket_id = 'avatars' and name in (p_target_user_id::text || '/avatar.webp', p_target_user_id::text || '/avatar.jpg');

  insert into public.admin_log (admin_id, action, target)
  values (auth.uid(), 'remove_avatar', p_target_user_id::text);
end;
$$;

grant execute on function public.admin_remove_avatar(uuid) to authenticated;
revoke execute on function public.admin_remove_avatar(uuid) from anon;

notify pgrst, 'reload schema';
