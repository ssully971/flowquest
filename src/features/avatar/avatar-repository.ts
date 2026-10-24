import { supabase } from '@/shared/supabase/client'

import type { ProcessedAvatar } from './process-avatar'

export class AvatarUploadError extends Error {}

/** Téléverse la photo recadrée dans le dossier de l'utilisateur (politique Storage :
 * écriture limitée à {uid}/..., migration 0024_avatars_storage.sql), nettoie l'autre
 * extension possible (un changement de format entre deux uploads ne doit jamais laisser
 * deux fichiers), et renvoie l'URL publique (le contournement de cache via
 * ?v=avatar_version est géré par le composant Avatar, pas ici). */
export async function uploadAvatar(userId: string, processed: ProcessedAvatar): Promise<string> {
  if (!supabase) throw new AvatarUploadError('Supabase non configuré')

  const path = `${userId}/avatar.${processed.extension}`
  const otherExtension = processed.extension === 'webp' ? 'jpg' : 'webp'

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, processed.blob, { contentType: processed.mimeType, upsert: true })
  if (uploadError) {
    throw new AvatarUploadError(uploadError.message)
  }

  // Best-effort : l'ancien fichier de l'autre extension peut ne pas exister, jamais
  // bloquant pour l'upload qui vient de réussir.
  await supabase.storage.from('avatars').remove([`${userId}/avatar.${otherExtension}`])

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/** Supprime les deux extensions possibles (best-effort) : l'appelant met ensuite
 * profiles.avatar_url à null séparément (voir useAvatarUpload). */
export async function removeAvatarFiles(userId: string): Promise<void> {
  if (!supabase) throw new AvatarUploadError('Supabase non configuré')
  const { error } = await supabase.storage
    .from('avatars')
    .remove([`${userId}/avatar.webp`, `${userId}/avatar.jpg`])
  if (error) {
    throw new AvatarUploadError(error.message)
  }
}
