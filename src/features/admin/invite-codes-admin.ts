import { supabase } from '@/shared/supabase/client'
import type { AdminInviteCodeRow, InviteCodeIssued } from '@/shared/supabase/database.types'

/** Génère un code d'accès (12 h) via admin_generate_invite_code() (SECURITE DEFINER,
 * vérifie is_admin() et journalise elle-même dans admin_log). */
export async function generateAdminInviteCode(): Promise<InviteCodeIssued> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { data, error } = await supabase.rpc('admin_generate_invite_code')
  if (error) throw error
  const issued = data?.[0]
  if (!issued) throw new Error('Aucun code renvoyé')
  return issued
}

export async function listAdminInviteCodes(limit = 50): Promise<AdminInviteCodeRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_invite_codes', { p_limit: limit })
  if (error) throw error
  return data ?? []
}

/** Révocation = expiration immédiate, via admin_revoke_invite_code() (jamais d'écriture
 * directe sur invite_codes). */
export async function revokeInviteCode(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.rpc('admin_revoke_invite_code', { p_id: id })
  if (error) throw error
}
