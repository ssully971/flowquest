import { useEffect, useRef, useState } from 'react'

/**
 * Empêche la mise en veille de l'écran tant que `enabled` est vrai (§5.4 et §7.6 du
 * cahier des charges). Se réacquiert automatiquement au retour au premier plan, car le
 * verrou système est relâché par le navigateur quand l'onglet passe en arrière-plan.
 * Ne fait rien si l'API Wake Lock n'est pas disponible sur ce navigateur.
 */
export function useWakeLock(enabled: boolean): { isSupported: boolean } {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const [isSupported] = useState(
    () => typeof navigator !== 'undefined' && Boolean(navigator.wakeLock),
  )

  useEffect(() => {
    if (!enabled || !isSupported) return

    let cancelled = false

    const acquire = () => {
      void navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (cancelled) {
            void sentinel.release()
            return
          }
          sentinelRef.current = sentinel
        })
        .catch(() => {
          // Refusé (onglet en arrière-plan, batterie faible, etc.) : pas d'alerte, on
          // réessaiera au prochain retour au premier plan.
        })
    }

    acquire()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) acquire()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinelRef.current?.release()
      sentinelRef.current = null
    }
  }, [enabled, isSupported])

  return { isSupported }
}
