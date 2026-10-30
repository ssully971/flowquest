import type { AuthStatus } from '@/features/auth/auth-context'

/** Fonctions réservées aux comptes (mode invité = entonnoir de conversion, voir
 * docs/MODE_INVITE.md). Pour en ajouter une : l'ajouter ici, dans strings.access.features,
 * puis brancher son point d'entrée avec useFeatureAccess. */
export type LockableFeature = 'stats' | 'tasks' | 'ambientSounds' | 'deepFocus'

/**
 * UNIQUE définition de la règle de verrouillage : verrouillé si et seulement si
 * l'utilisateur est un invité ET que les comptes existent sur ce déploiement. Sans
 * Supabase (déploiement 100 % local), rien n'est verrouillé : personne ne pourrait jamais
 * débloquer ces fonctions. Pendant le chargement de la session, rien n'est verrouillé non
 * plus (pas de flash de cadenas chez un utilisateur connecté).
 */
export function isGuestLocked(status: AuthStatus, isSupabaseConfigured: boolean): boolean {
  return isSupabaseConfigured && status === 'guest'
}
