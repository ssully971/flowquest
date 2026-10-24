import { useCallback, useEffect, useId, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

import { FriendsError, listDuoStreaks } from './friends-repository'
import type { DuoStreak } from './types'

function errorMessage(err: unknown): string {
  return err instanceof FriendsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/** Série partagée avec chaque ami (Mode Amis, LOT F4) : une ligne par ami ayant au moins
 * une série commune démarrée, tenue à jour par un trigger côté base
 * (bump_duo_streaks(), migration 0031) à chaque session de focus complétée — ici on ne
 * fait que lire, avec un abonnement Realtime sur duo_streaks pour refléter la série de
 * l'ami sans attendre un rechargement manuel. */
export function useDuoStreaks() {
  const { status } = useAuth()
  const [streaks, setStreaks] = useState<DuoStreak[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (status !== 'authenticated') return Promise.resolve()
    return listDuoStreaks()
      .then((result) => {
        setStreaks(result)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setLoadError(errorMessage(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Suffixe useId() : un seul mount prévu aujourd'hui (FriendsPanel), mais la collision
  // de canal trouvée en LOT F3 (useFriendsRealtime, deux montages simultanés) a montré
  // qu'un nom de canal fixe est une dette qui revient cher — un nom par instance coûte
  // rien et évite d'y repenser si un second écran venait à utiliser ce hook.
  const instanceId = useId()
  useRealtimeSync(
    `duo-streaks-${instanceId}`,
    (channel, notify) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'duo_streaks' }, notify)
    },
    refresh,
    status === 'authenticated',
  )

  return { streaks, isLoading, loadError, refresh }
}
