import type { RoomState } from './types'

/**
 * Temps écoulé dans le salon, toujours dérivé de `startedAt`/`elapsedMsAtPause` plutôt
 * qu'accumulé localement (même principe que le moteur du minuteur individuel) : reste
 * exact même si l'onglet a été suspendu (iPad Safari) ou l'appareil changé.
 */
export function computeRoomElapsedMs(room: Pick<RoomState, 'status' | 'startedAt' | 'elapsedMsAtPause'>, now: number): number {
  if (room.status === 'paused') return room.elapsedMsAtPause ?? 0
  if (room.status === 'running' && room.startedAt) {
    return Math.max(0, now - new Date(room.startedAt).getTime())
  }
  return 0
}

export function computeRoomRemainingMs(
  room: Pick<RoomState, 'status' | 'startedAt' | 'elapsedMsAtPause' | 'durationMs'>,
  now: number,
): number {
  if (room.durationMs === null) return 0
  if (room.status === 'ended') return 0
  return Math.max(0, room.durationMs - computeRoomElapsedMs(room, now))
}
