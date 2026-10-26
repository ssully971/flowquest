import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type AdminFeatureFlagRow = Database['public']['Tables']['feature_flags']['Row']

/** Tous les drapeaux (lecture publique côté RLS, mais seul le panneau Admin les liste
 * tous avec leur détail complet — updated_by/updated_at). */
export async function listFeatureFlags(): Promise<AdminFeatureFlagRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('feature_flags').select('*').order('key')
  return error || !data ? [] : data
}

/** Passe par la RPC admin_set_feature_flag() (SECURITY DEFINER, vérifie is_admin(),
 * journalise elle-même dans admin_log) — jamais d'écriture directe sur la table. */
export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  description?: string,
): Promise<AdminFeatureFlagRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_set_feature_flag', {
    flag_key: key,
    new_enabled: enabled,
    new_description: description ?? null,
  })
  return error || !data ? null : data
}
