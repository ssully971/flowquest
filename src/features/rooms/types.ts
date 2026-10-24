import type { RoomParticipantRole, RoomParticipantStatus, RoomStatus } from '@/shared/supabase/database.types'

export type { RoomParticipantRole, RoomParticipantStatus, RoomStatus }

export interface MyRoom {
  roomId: string
  hostId: string
  hostUsername: string
  hostDisplayName: string | null
  status: RoomStatus
  focusMinutes: number
  myStatus: RoomParticipantStatus
  participantCount: number
  createdAt: string
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
  focusMinutes: number
  startedAt: string | null
  durationMs: number | null
  elapsedMsAtPause: number | null
  createdAt: string
  endedAt: string | null
  participants: RoomParticipant[]
}

/** Un salon réunit au plus 6 personnes (hôte compris) — volontairement restreint pour ce
 * premier lot, voir docs/AMIS.md. */
export const ROOM_MAX_INVITEES = 5
export const ROOM_MIN_FOCUS_MINUTES = 5
export const ROOM_MAX_FOCUS_MINUTES = 120
