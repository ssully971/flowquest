import { supabase } from '@/shared/supabase/client'
import type { AdminUserPillarRow, Database } from '@/shared/supabase/database.types'

export type XpGrantRow = Database['public']['Tables']['xp_grants']['Row']

export async function listUserPillarsForGrant(targetUserId: string): Promise<AdminUserPillarRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_user_pillars', {
    p_target_user_id: targetUserId,
  })
  return error || !data ? [] : data
}

export const XP_GRANT_MAX_AMOUNT = 1000

export async function grantXp(
  targetUserId: string,
  pillarId: string,
  amount: number,
  reason: string,
): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.rpc('admin_grant_xp', {
    p_target_user_id: targetUserId,
    p_pillar_id: pillarId,
    p_amount: amount,
    p_reason: reason,
  })
  if (error) throw error
}
