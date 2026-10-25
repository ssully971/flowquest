import { useId } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

/**
 * Supabase Realtime pour les demandes d'ami (LOT H1) : rafraîchit `onChange` dès qu'une
 * ligne `friendships` me concernant change (reçue ou envoyée) — jusqu'ici seul le statut
 * en direct (useFriendsRealtime, live_status) était temps réel, les demandes elles-mêmes
 * n'apparaissaient qu'après un rechargement manuel.
 *
 * Deux abonnements sur le même canal (requester_id et addressee_id) : le filtre Realtime
 * de Supabase n'accepte qu'une seule colonne par abonnement, pas de OR composé.
 *
 * Suffixe `useId()` sur le nom du canal, même raison que useFriendsRealtime.ts (LOT F3) :
 * useFriends() peut être monté plusieurs fois (FriendsPanel toujours monté, visible ou
 * non), un nom de canal fixe ferait planter le client realtime-js au second abonnement.
 */
export function useFriendshipsRealtime(onChange: () => void, enabled: boolean): void {
  const { user } = useAuth()
  const instanceId = useId()
  const userId = user?.id ?? null

  useRealtimeSync(
    `friendships-${instanceId}`,
    (channel, notify) => {
      if (!userId) return
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${userId}` },
          notify,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${userId}` },
          notify,
        )
    },
    onChange,
    enabled && userId !== null,
  )
}
