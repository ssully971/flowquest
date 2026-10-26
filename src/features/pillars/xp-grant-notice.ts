import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type XpGrantRow = Database['public']['Tables']['xp_grants']['Row']

/** Cadeaux d'XP reçus pas encore vus (LOT I3, §6) — xp_grants_select_own (0046) ne
 * renvoie jamais que les lignes du compte connecté. */
export async function listUnseenXpGrants(): Promise<XpGrantRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('xp_grants')
    .select('*')
    .is('seen_at', null)
    .order('created_at', { ascending: true })
  return error || !data ? [] : data
}

/** Best-effort : si l'accusé de réception échoue (hors ligne...), le message
 * réapparaîtra simplement au prochain chargement plutôt que de bloquer quoi que ce soit. */
export async function acknowledgeXpGrant(grantId: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('acknowledge_xp_grant', { p_grant_id: grantId })
}
