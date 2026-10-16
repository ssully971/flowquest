import { useEffect } from 'react'

import { setCurrentUserId } from './current-user'
import { useAuth } from './useAuth'

/**
 * Tient current-user.ts à jour en permanence (appelé une fois, au niveau racine de
 * l'app — AppShell — pas depuis un écran particulier) : plusieurs dépôts/modules hors
 * React (SyncingTimerStateRepository, l'enregistreur de sessions) lisent cet accesseur
 * dynamiquement, et doivent le voir juste même si l'utilisateur n'a jamais ouvert
 * l'écran Focus depuis sa connexion.
 */
export function useCurrentUserSync(): void {
  const { status, user } = useAuth()

  useEffect(() => {
    setCurrentUserId(status === 'authenticated' ? (user?.id ?? null) : null)
  }, [status, user])
}
