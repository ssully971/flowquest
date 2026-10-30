import { effectiveOffsetMs } from './clock-offset'
import { computeRoomView, phaseDurationMs } from './room-timer'
import type { RoomState } from './types'

/** Les actions d'un salon qui modifient son état. */
export type RoomActionKind = 'start' | 'pause' | 'resume' | 'end' | 'leave' | 'transfer'

/** Heure du serveur estimée à l'instant local `now` (écart d'horloge déjà lissé). */
function serverNow(room: RoomState, now: number): number {
  return (
    now -
    effectiveOffsetMs(
      {
        targetMs: room.clockOffsetMs,
        residualMs: room.clockResidualMs ?? 0,
        slewStartedAt: room.clockSlewStartedAt ?? now,
      },
      now,
    )
  )
}

/**
 * Résultat attendu d'une action, appliqué tout de suite à l'écran (mise à jour OPTIMISTE) en
 * attendant la confirmation du serveur ; annulé (rollback) si l'action échoue. Miroir
 * volontairement minimal des RPC SQL (start_room, pause_room…) : le serveur reste la source
 * de vérité, le rechargement qui suit l'action remplace ce résultat.
 *
 * Renvoie `null` quand l'action n'aurait aucun effet visible (déjà dans cet état).
 */
export function applyOptimistic(
  room: RoomState,
  action: RoomActionKind,
  options: { now: number; userId: string | null; targetUserId?: string },
): RoomState | null {
  const { now, userId, targetUserId } = options
  switch (action) {
    case 'start': {
      if (room.status !== 'lobby') return null
      return {
        ...room,
        status: 'running',
        phase: 'focus',
        phaseIndex: 0,
        startedAt: new Date(serverNow(room, now)).toISOString(),
        durationMs: phaseDurationMs(room, 'focus'),
        elapsedMsAtPause: null,
      }
    }
    case 'pause': {
      if (room.status !== 'running') return null
      const view = computeRoomView(room, now)
      const elapsed =
        view.durationMs === null ? view.elapsedMs : Math.min(view.elapsedMs, view.durationMs)
      return {
        ...room,
        status: 'paused',
        phase: view.phase,
        phaseIndex: view.phaseIndex,
        durationMs: view.durationMs,
        // Même repère que le serveur : le temps déjà écoulé dans la phase affichée.
        elapsedMsAtPause: elapsed,
      }
    }
    case 'resume': {
      if (room.status !== 'paused') return null
      return {
        ...room,
        status: 'running',
        startedAt: new Date(serverNow(room, now) - (room.elapsedMsAtPause ?? 0)).toISOString(),
        elapsedMsAtPause: null,
      }
    }
    case 'end': {
      if (room.status === 'ended') return null
      return { ...room, status: 'ended', endedAt: new Date(serverNow(room, now)).toISOString() }
    }
    case 'leave': {
      if (!userId) return null
      const me = room.participants.find((participant) => participant.userId === userId)
      if (!me || me.status !== 'joined') return null
      return {
        ...room,
        participants: room.participants.map((participant) =>
          participant.userId === userId ? { ...participant, status: 'left' } : participant,
        ),
      }
    }
    case 'transfer': {
      if (!targetUserId || room.hostId === targetUserId) return null
      return {
        ...room,
        hostId: targetUserId,
        participants: room.participants.map((participant) => {
          if (participant.userId === targetUserId) return { ...participant, role: 'host' }
          if (participant.role === 'host') return { ...participant, role: 'member' }
          return participant
        }),
      }
    }
  }
}
