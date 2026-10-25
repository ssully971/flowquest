import { useId } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

/**
 * Supabase Realtime pour MES lignes room_participants, tous salons confondus (LOT H1) —
 * distinct de useRoomRealtime (filtré sur un `room_id` déjà connu, utile seulement une
 * fois à l'intérieur d'un salon) : ici, aucun `room_id` à l'avance, puisque le but est
 * justement de détecter une invitation à un salon dont on ne connaît pas encore
 * l'existence. `room_participants` est déjà dans la publication supabase_realtime
 * (migration 0028) ; rien à ajouter côté base pour ce hook.
 */
export function useRoomInvitesRealtime(onChange: () => void, enabled: boolean): void {
  const { user } = useAuth()
  const instanceId = useId()
  const userId = user?.id ?? null

  useRealtimeSync(
    `room-invites-${instanceId}`,
    (channel, notify) => {
      if (!userId) return
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants', filter: `user_id=eq.${userId}` },
        notify,
      )
    },
    onChange,
    enabled && userId !== null,
  )
}
