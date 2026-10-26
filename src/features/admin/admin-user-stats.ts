import { supabase } from '@/shared/supabase/client'
import type { AdminUserStats } from '@/shared/supabase/database.types'

/** Chaque appel journalise l'ouverture côté serveur (admin_user_stats(), §3 : « chaque
 * ouverture est consignée »), jamais besoin de le faire en plus côté client. */
export async function fetchAdminUserStats(targetUserId: string): Promise<AdminUserStats | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_user_stats', { p_target_user_id: targetUserId })
  return error || !data ? null : data
}
