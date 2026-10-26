export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

// Mots qu'on ne laisse jamais choisir comme pseudo, même si le format est valide par
// ailleurs (rôles/identité du produit, valeurs techniques qui prêteraient à confusion).
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrateur',
  'administrator',
  'modo',
  'moderateur',
  'modérateur',
  'moderator',
  'staff',
  'root',
  'system',
  'null',
  'undefined',
  'support',
  // Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
  'flowquest',
  'fokitsu',
])

export type UsernameFormatIssue = 'tooShort' | 'tooLong' | 'invalidChars' | 'reserved'

/** Vérifications de forme uniquement (synchrones, sans accès réseau) : longueur,
 * caractères autorisés, mots réservés. La disponibilité réelle (pseudo déjà pris par un
 * autre compte) est vérifiée séparément via useUsernameAvailability, en direct pendant
 * la saisie. */
export function getUsernameFormatIssue(username: string): UsernameFormatIssue | null {
  if (username.length < USERNAME_MIN_LENGTH) return 'tooShort'
  if (username.length > USERNAME_MAX_LENGTH) return 'tooLong'
  if (!/^[a-z0-9_]+$/.test(username)) return 'invalidChars'
  if (RESERVED_USERNAMES.has(username)) return 'reserved'
  return null
}

export function isValidUsername(username: string): boolean {
  return getUsernameFormatIssue(username) === null
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
