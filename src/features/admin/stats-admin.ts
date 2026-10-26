import { supabase } from '@/shared/supabase/client'
import type { AdminStatsOverview } from '@/shared/supabase/database.types'

export async function fetchAdminStatsOverview(): Promise<AdminStatsOverview | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_stats_overview')
  return error || !data ? null : data
}
