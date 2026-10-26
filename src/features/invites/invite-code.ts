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

export function formatInviteDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** « 4 h 20 » à partir d'un nombre de secondes (heures pleines : « 10 h »). */
export function formatFocusDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}

/** « 1er novembre » / « 12 novembre » — jour du mois dans le fuseau de la Guadeloupe, celui
 * qui définit le mois calendaire côté serveur. */
export function formatResetDate(iso: string): string {
  const date = new Date(iso)
  const timeZone = 'America/Guadeloupe'
  const day = Number(new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone }).format(date))
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone }).format(date)
  return `${day === 1 ? '1er' : day} ${month}`
}
