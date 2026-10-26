import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type GameCampaignRow = Database['public']['Tables']['game_campaigns']['Row']

export async function listCampaigns(): Promise<GameCampaignRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_campaigns')
  return error || !data ? [] : data
}

/** Raccourci « Activer le week-end Double XP » (§6) : ×2 pendant 48 h à partir de
 * maintenant. */
export async function startDoubleXpWeekend(): Promise<GameCampaignRow | null> {
  if (!supabase) return null
  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + 48 * 60 * 60 * 1000)
  const { data, error } = await supabase.rpc('admin_start_campaign', {
    p_name: 'Week-end Double XP',
    p_xp_multiplier: 2,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
  })
  return error || !data ? null : data
}

export async function startCustomCampaign(
  name: string,
  xpMultiplier: number,
  startsAt: Date,
  endsAt: Date,
): Promise<GameCampaignRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_start_campaign', {
    p_name: name,
    p_xp_multiplier: xpMultiplier,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
  })
  return error || !data ? null : data
}

export async function stopCampaign(campaignId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_stop_campaign', { p_campaign_id: campaignId })
  return !error
}
