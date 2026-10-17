import { supabase } from '@/shared/supabase/client'

/**
 * Journalise une action admin (§12 : « qui, quoi, quand »). À appeler après chaque mutation
 * admin réussie (citation créée, nouveauté modifiée, message support traité...), jamais avant :
 * on ne journalise pas une action qui a échoué. Best-effort — un échec d'écriture du journal
 * ne doit jamais faire échouer la mutation elle-même ni bloquer l'interface.
 */
export async function logAdminAction(adminId: string, action: string, target: string): Promise<void> {
  if (!supabase) return
  await supabase.from('admin_log').insert({ admin_id: adminId, action, target })
}
