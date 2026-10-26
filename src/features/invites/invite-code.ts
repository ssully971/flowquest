/** Alphabet des codes d'invitation : sans 0/O/1/I/L (ambigus) — miroir de la contrainte
 * `invite_codes_code_format` (supabase/migrations/0047_invite_codes.sql). */
const INVITE_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6,8}$/

/** Trim, retrait des espaces/tirets internes (copier-coller « ABCD-EFGH »), majuscules. */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase()
}

/** Contrôle de forme uniquement (évite un appel réseau pour une saisie impossible) : la
 * validité réelle (existe, non utilisé, non expiré) n'est connue que du serveur. */
export function isInviteCodeWellFormed(code: string): boolean {
  return INVITE_CODE_PATTERN.test(code)
}
