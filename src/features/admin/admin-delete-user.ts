import { supabase } from '@/shared/supabase/client'

/** Suppression « nucléaire » (§5) : retourne false en cas d'échec (pseudo de
 * confirmation incorrect, cible introuvable, auto-suppression, autre admin...) — le
 * message d'erreur exact de Supabase reste disponible via le throw pour l'affichage. */
export async function deleteUserNuclear(
  targetUserId: string,
  confirmUsername: string,
): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.rpc('admin_delete_user', {
    p_target_user_id: targetUserId,
    p_confirm_username: confirmUsername,
  })
  if (error) throw error
}
