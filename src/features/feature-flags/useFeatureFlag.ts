import { useEffect, useId, useState } from 'react'

import { isSupabaseConfigured } from '@/shared/supabase/client'
import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

import { ensureFlagsFetched, getCachedFlag, setCachedFlag } from './feature-flags-cache'
import type { FlagKey } from './flag-defaults'

interface FeatureFlagChangePayload {
  key?: string
  enabled?: boolean
}

/**
 * Coupe-circuit (lot I2, §1) : valeur par défaut codée en dur immédiatement (jamais
 * d'attente ni d'état de chargement visible), rafraîchie dès que le premier appel réseau
 * de la session répond, puis tenue à jour en direct par Supabase Realtime — quand un
 * drapeau passe sur OFF, la fonctionnalité disparaît chez les utilisateurs connectés en
 * quelques secondes, sans rechargement. Si les drapeaux ne se chargent jamais (hors
 * ligne, service en panne), on garde la valeur par défaut : la panne du service de
 * drapeaux ne doit jamais couper l'application.
 */
export function useFeatureFlag(key: FlagKey): boolean {
  const [value, setValue] = useState<boolean>(() => getCachedFlag(key))

  useEffect(() => {
    let cancelled = false
    void ensureFlagsFetched().then(() => {
      if (!cancelled) setValue(getCachedFlag(key))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  // Un canal par instance (useId, même raison que useFriendshipsRealtime.ts) : plusieurs
  // FeatureGate peuvent être montés en même temps sans se marcher dessus.
  const instanceId = useId()
  useRealtimeSync(
    `feature-flags-${instanceId}`,
    (channel, notify) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_flags' },
        (payload) => {
          const row = (payload.new ?? payload.old) as FeatureFlagChangePayload | null
          if (row?.key && typeof row.enabled === 'boolean') {
            setCachedFlag(row.key as FlagKey, row.enabled)
          }
          notify()
        },
      )
    },
    () => setValue(getCachedFlag(key)),
    isSupabaseConfigured,
  )

  return value
}
