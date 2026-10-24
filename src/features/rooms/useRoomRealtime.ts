import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

/**
 * Supabase Realtime pour un salon de focus (Mode Amis, LOT F3) : rafraîchit `onChange` à
 * chaque évènement sur `rooms` ou `room_participants` pour ce salon précis (démarrage,
 * pause, reprise, arrivée/départ d'un participant, transfert d'hôte). Repose sur
 * `useRealtimeSync` (reconnexion sur `visibilitychange`, repli par interrogation toutes
 * les 30 s), exactement comme annoncé dans docs/AMIS.md lors du LOT F2.
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
  )
}
