import { supabase } from '@/shared/supabase/client'
import type { AdminUserExportRow, AdminUserRow } from '@/shared/supabase/database.types'

export type AdminUserSort =
  'created_at_desc' | 'created_at_asc' | 'last_active_desc' | 'username_asc'

/**
 * Échec d'une RPC admin : porte le VRAI code et message renvoyés par Supabase, pour que le
 * panneau les affiche au lieu de les avaler (une liste vide et un échec doivent rester
 * discernables — voir supabase/diagnostics/admin_users_check.sql).
 */
export class AdminUsersError extends Error {
  readonly code: string | null
  readonly details: string | null

  constructor(message: string, code: string | null = null, details: string | null = null) {
    super(message)
    this.code = code
    this.details = details
  }

  /** Texte technique pour le diagnostic : « code — message (détails) ». */
  get technical(): string {
    return [this.code, this.message, this.details ? `(${this.details})` : null]
      .filter((part): part is string => Boolean(part))
      .join(' — ')
  }
}

interface RpcError {
  message: string
  code?: string
  details?: string | null
}

function failure(error: RpcError): AdminUsersError {
  return new AdminUsersError(error.message, error.code ?? null, error.details ?? null)
}

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
  if (error) throw failure(error)
  return data ?? []
}

export async function exportAdminUsers(onlyConsented: boolean): Promise<AdminUserExportRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_export_users', {
    p_only_consented: onlyConsented,
  })
  if (error) throw failure(error)
  return data ?? []
}

export async function suspendUser(
  targetUserId: string,
  durationDays: 1 | 7 | 30,
  reason: string | null,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_suspend_user', {
    p_target_user_id: targetUserId,
    p_duration_days: durationDays,
    p_reason: reason && reason.trim() ? reason.trim() : null,
  })
  if (error) throw failure(error)
}

export async function unsuspendUser(targetUserId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_unsuspend_user', { p_target_user_id: targetUserId })
  if (error) throw failure(error)
}

export async function banUser(targetUserId: string, reason: string | null): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_ban_user', {
    p_target_user_id: targetUserId,
    p_reason: reason && reason.trim() ? reason.trim() : null,
  })
  if (error) throw failure(error)
}

export async function unbanUser(targetUserId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_unban_user', { p_target_user_id: targetUserId })
  if (error) throw failure(error)
}

export async function removeUserAvatar(targetUserId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_remove_avatar', { p_target_user_id: targetUserId })
  if (error) throw failure(error)
}

/** Crée la ligne profiles manquante d'un compte (migration 0051). */
export async function repairUserProfile(targetUserId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_repair_profile', { p_target_user_id: targetUserId })
  if (error) throw failure(error)
}
