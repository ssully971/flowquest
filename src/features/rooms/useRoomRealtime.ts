import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

/** Simple filet (le canal fonctionne) : l'état est de toute façon rechargé sur évènement. */
const ROOM_SAFETY_POLL_MS = 60_000

/** Ce qui a déclenché un rechargement :
 *  - `room` : transition d'état du salon (démarrage, pause, fin…) avec sa version
 *    (`rooms.updated_at`), pour ignorer un évènement déjà pris en compte ;
 *  - `participants` : arrivée, départ ou changement de rôle ;
 *  - `resync` : reconnexion, retour au premier plan ou filet de sécurité. */
export type RoomRealtimeEvent =
  { kind: 'room'; version: string | null } | { kind: 'participants' } | { kind: 'resync' }

function versionOf(payload: unknown): string | null {
  const row = (payload as { new?: { updated_at?: unknown } } | null)?.new
  return typeof row?.updated_at === 'string' ? row.updated_at : null
}

/**
 * Supabase Realtime pour un salon de focus (Mode Amis) :
 *  - `postgres_changes` sur `rooms` filtré par id : rare (transitions d'état seulement) ;
 *  - `postgres_changes` sur `room_participants` filtré par salon : arrivées, départs, rôles —
 *    plus jamais le battement de cœur, qui vit dans `room_heartbeats` (migration 0050, hors
 *    publication) ;
 *  - Supabase Presence sur le même canal : qui est EN LIGNE maintenant, sans aucune écriture
 *    en base (`presentUserIds`, `null` tant que la première synchronisation n'a pas eu lieu).
 * Repose sur `useRealtimeSync` (resynchronisation au retour au premier plan, repli à 4 s
 * tant que le canal n'est pas SUBSCRIBED, filet à 60 s).
 */
export function useRoomRealtime(
  roomId: string | null,
  onEvent: (event: RoomRealtimeEvent) => void,
  enabled: boolean,
  userId: string | null = null,
): { presentUserIds: ReadonlySet<string> | null } {
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  // Rangée avec l'identifiant du salon : la présence d'un ancien salon n'est jamais affichée
  // pour le nouveau.
  const [presence, setPresence] = useState<{ roomId: string; ids: ReadonlySet<string> } | null>(
    null,
  )

  const emit = useCallback((event: RoomRealtimeEvent) => onEventRef.current(event), [])

  useRealtimeSync(
    roomId ? `room-${roomId}` : 'room-inactive',
    (channel) => {
      if (!roomId) return
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
          (payload) => emit({ kind: 'room', version: versionOf(payload) }),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_participants',
            filter: `room_id=eq.${roomId}`,
          },
          () => emit({ kind: 'participants' }),
        )
        .on('presence', { event: 'sync' }, () => {
          setPresence({ roomId, ids: new Set(Object.keys(channel.presenceState())) })
        })
    },
    () => emit({ kind: 'resync' }),
    enabled && roomId !== null,
    {
      safetyPollMs: ROOM_SAFETY_POLL_MS,
      channelOptions: userId ? { config: { presence: { key: userId } } } : undefined,
      // Presence ne survit pas à une reconnexion : on se déclare de nouveau à chaque SUBSCRIBED.
      onSubscribed: (channel: RealtimeChannel) => {
        void channel.track({ at: new Date().toISOString() })
      },
    },
  )

  return {
    presentUserIds: presence && presence.roomId === roomId ? presence.ids : null,
  }
}
