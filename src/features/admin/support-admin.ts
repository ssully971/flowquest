import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type AdminSupportMessageRow = Database['public']['Tables']['support_messages']['Row']

/** Tous les messages (politique support_messages_select_admin) : réservé au panneau Admin. */
export async function listSupportMessages(): Promise<AdminSupportMessageRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .order('created_at', { ascending: false })
  return error || !data ? [] : data
}

export async function setSupportMessageStatus(
  id: string,
  status: 'pending' | 'processed',
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('support_messages').update({ status }).eq('id', id)
  return !error
}
