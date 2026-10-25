import { useId } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

/**
 * Supabase Realtime pour les encouragements reçus (LOT H1) : jusqu'ici useCheers() ne se
 * rafraîchissait qu'à l'ouverture de l'app et à chaque fin de session — un encouragement
 * reçu pendant que l'app est déjà ouverte n'apparaissait qu'après un rechargement.
 */
export function useCheersRealtime(onChange: () => void, enabled: boolean): void {
  const { user } = useAuth()
  const instanceId = useId()
  const userId = user?.id ?? null

  useRealtimeSync(
    `cheers-${instanceId}`,
    (channel, notify) => {
      if (!userId) return
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cheers', filter: `recipient_id=eq.${userId}` },
        notify,
      )
    },
    onChange,
    enabled && userId !== null,
  )
}
