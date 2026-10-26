import { supabase } from '@/shared/supabase/client'
import type {
  InviteCodeIssued,
  InviteEligibilityRow,
  MyInviteCodeRow,
} from '@/shared/supabase/database.types'

/** Erreurs typées levées par les fonctions SQL (le message Postgres EST la clé). */
export type InviteErrorKind =
  | 'account_too_young'
  | 'not_enough_focus'
  | 'monthly_limit_reached'
  | 'too_many_attempts'
  | 'account_unavailable'
  | 'not_authenticated'
  | 'unknown'

const ERROR_KINDS: InviteErrorKind[] = [
  'account_too_young',
  'not_enough_focus',
  'monthly_limit_reached',
  'too_many_attempts',
  'account_unavailable',
  'not_authenticated',
]

export class InviteError extends Error {
  readonly kind: InviteErrorKind

  constructor(kind: InviteErrorKind) {
    super(kind)
    this.name = 'InviteError'
    this.kind = kind
  }
}

export function toInviteError(error: { message?: string } | null | undefined): InviteError {
  const message = error?.message ?? ''
  const kind = ERROR_KINDS.find((candidate) => message.includes(candidate)) ?? 'unknown'
  return new InviteError(kind)
}

/** Vérification en direct dans le formulaire d'inscription : indice UX seulement (la vraie
 * garde est le trigger d'inscription). `false` pour tout code invalide, sans distinction. */
export async function checkInviteCode(code: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('check_invite_code', { p_code: code })
  if (error) throw toInviteError(error)
  return data === true
}

/** Active un compte Google en attente. `false` : code invalide (raison non précisée). */
export async function consumeInviteCode(code: string): Promise<boolean> {
  if (!supabase) throw new InviteError('unknown')
  const { data, error } = await supabase.rpc('consume_invite_code', { p_code: code })
  if (error) throw toInviteError(error)
  return data === true
}

export async function getInviteEligibility(): Promise<InviteEligibilityRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_invite_eligibility')
  if (error) throw toInviteError(error)
  return data?.[0] ?? null
}

export async function generateUserInviteCode(): Promise<InviteCodeIssued> {
  if (!supabase) throw new InviteError('unknown')
  const { data, error } = await supabase.rpc('user_generate_invite_code')
  if (error) throw toInviteError(error)
  const issued = data?.[0]
  if (!issued) throw new InviteError('unknown')
  return issued
}

export async function listMyInviteCodes(): Promise<MyInviteCodeRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_my_invite_codes')
  if (error) throw toInviteError(error)
  return data ?? []
}
