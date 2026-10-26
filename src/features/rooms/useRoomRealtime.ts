import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

const ROOM_SAFETY_POLL_MS = 15_000

/**
 * Supabase Realtime pour un salon de focus (Mode Amis, LOT F3) : rafraîchit `onChange` à
 * chaque évènement sur `rooms` ou `room_participants` pour ce salon précis (démarrage,
 * pause, reprise, arrivée/départ d'un participant, transfert d'hôte). Repose sur
 * `useRealtimeSync` (resynchronisation au retour au premier plan, repli par interrogation
 * toutes les 4 s tant que le canal n'est pas SUBSCRIBED), exactement comme annoncé dans docs/AMIS.md lors du LOT F2.
 */
export function useRoomRealtime(roomId: string | null, onChange: () => void, enabled: boolean): void {
  useRealtimeSync(
    roomId ? `room-${roomId}` : 'room-inactive',
    (channel, notify) => {
      if (!roomId) return
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, notify)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
          notify,
        )
    },
    onChange,
    enabled && roomId !== null,
    // Filet contre un canal « zombie » (Safari) : l'état du salon est de toute façon
    // recalculé depuis le serveur, jamais accumulé localement.
    { safetyPollMs: ROOM_SAFETY_POLL_MS },
  )
}
