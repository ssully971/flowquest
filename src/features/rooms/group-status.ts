import type { RoomClockView } from './room-timer'
import type { RoomParticipant } from './types'

export type ParticipantLiveStatus =
  | 'focused'
  | 'paused'
  | 'away'
  | 'ready'
  | 'invited'
  | 'declined'

/**
 * Statut en direct d'un participant dans l'horloge de groupe : concentré (salon qui tourne,
 * phase de focus), en pause (salon en pause ou pause Pomodoro), parti (plus de signe de vie
 * depuis 2 minutes, ou quitté), prêt (salon en attente), invité / a refusé. Dérivé de l'état
 * serveur du participant et de l'horloge du salon — aucune donnée envoyée par le client.
 */
export function participantLiveStatus(
  participant: Pick<RoomParticipant, 'status' | 'isPresent'>,
  view: Pick<RoomClockView, 'status' | 'phase'> | null,
): ParticipantLiveStatus {
  if (participant.status === 'invited') return 'invited'
  if (participant.status === 'declined') return 'declined'
  if (participant.status !== 'joined') return 'away'
  if (!participant.isPresent) return 'away'
  if (!view || view.status === 'lobby') return 'ready'
  if (view.status === 'paused') return 'paused'
  if (view.status === 'running' && view.phase === 'focus') return 'focused'
  return 'paused'
}
