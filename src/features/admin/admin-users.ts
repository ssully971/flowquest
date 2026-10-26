import { supabase } from '@/shared/supabase/client'
import type { AdminUserExportRow, AdminUserRow } from '@/shared/supabase/database.types'

export type AdminUserSort =
  'created_at_desc' | 'created_at_asc' | 'last_active_desc' | 'username_asc'

export async function listAdminUsers(
  limit: number,
  offset: number,
  search: string | null,
  sort: AdminUserSort,
): Promise<AdminUserRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_limit: limit,
    p_offset: offset,
    p_search: search && search.trim() ? search.trim() : null,
    p_sort: sort,
  })
  return error || !data ? [] : data
}

export async function exportAdminUsers(onlyConsented: boolean): Promise<AdminUserExportRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_export_users', {
    p_only_consented: onlyConsented,
  })
  return error || !data ? [] : data
}

export async function suspendUser(
  targetUserId: string,
  durationDays: 1 | 7 | 30,
  reason: string | null,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_suspend_user', {
    p_target_user_id: targetUserId,
    p_duration_days: durationDays,
    p_reason: reason && reason.trim() ? reason.trim() : null,
  })
  return !error
}

export async function unsuspendUser(targetUserId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_unsuspend_user', { p_target_user_id: targetUserId })
  return !error
}

export async function banUser(targetUserId: string, reason: string | null): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_ban_user', {
    p_target_user_id: targetUserId,
    p_reason: reason && reason.trim() ? reason.trim() : null,
  })
  return !error
}

export async function unbanUser(targetUserId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_unban_user', { p_target_user_id: targetUserId })
  return !error
}

export async function removeUserAvatar(targetUserId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_remove_avatar', { p_target_user_id: targetUserId })
  return !error
}
