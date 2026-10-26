import { supabase } from '@/shared/supabase/client'
import type { AdminLogRow } from '@/shared/supabase/database.types'

export async function listAdminLog(limit: number, search: string | null): Promise<AdminLogRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_log', {
    p_limit: limit,
    p_search: search && search.trim() ? search.trim() : null,
  })
  return error || !data ? [] : data
}
