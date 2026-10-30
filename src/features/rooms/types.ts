import type {
  RoomMode,
  RoomParticipantRole,
  RoomParticipantStatus,
  RoomPhase,
  RoomStatus,
} from '@/shared/supabase/database.types'

export type { RoomMode, RoomParticipantRole, RoomParticipantStatus, RoomPhase, RoomStatus }

export interface MyRoom {
  roomId: string
  hostId: string
  hostUsername: string
  hostDisplayName: string | null
  status: RoomStatus
  focusMinutes: number | null
  myStatus: RoomParticipantStatus
  participantCount: number
  createdAt: string
  mode: RoomMode
  phase: RoomPhase
  startedAt: string | null
  durationMs: number | null
  elapsedMsAtPause: number | null
}

export interface RoomParticipant {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarVersion: number
  role: RoomParticipantRole
  status: RoomParticipantStatus
  isPresent: boolean
}

export interface RoomState {
  roomId: string
  hostId: string
  status: RoomStatus
  /** null en mode Chrono. */
  focusMinutes: number | null
  mode: RoomMode
  shortBreakMinutes: number | null
  longBreakMinutes: number | null
  sessionsBeforeLongBreak: number | null
  /** Phase courante et son numéro (Pomodoro : focus, pause courte, focus... pause longue). */
  phase: RoomPhase
  phaseIndex: number
  /** Début de la phase courante (heure du SERVEUR) — jamais un compteur local. */
  startedAt: string | null
  durationMs: number | null
  elapsedMsAtPause: number | null
  createdAt: string
  endedAt: string | null
  /** Écart d'horloge appareil − serveur (ms) mesuré à la dernière réponse : `Date.now() -
   * clockOffsetMs` ≈ heure serveur, même sur un appareil à l'heure fausse. */
  clockOffsetMs: number
  /** Reliquat d'écart d'horloge encore à résorber (ms) et heure locale de son début : voir
   * clock-offset.ts. Absents = aucun recalage en cours. */
  clockResidualMs?: number
  clockSlewStartedAt?: number
  /** Version du salon (rooms.updated_at, ISO) : sert à ignorer les évènements Realtime déjà
   * pris en compte. */
  updatedAt?: string | null
  participants: RoomParticipant[]
}

/** Un salon réunit au plus 6 personnes (hôte compris) — volontairement restreint pour ce
 * premier lot, voir docs/AMIS.md. */
export const ROOM_MAX_INVITEES = 5
export const ROOM_MIN_FOCUS_MINUTES = 5
export const ROOM_MAX_FOCUS_MINUTES = 120
