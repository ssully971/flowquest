import { supabase } from '@/shared/supabase/client'
import type { MyRoomRow, RoomStateRow } from '@/shared/supabase/database.types'

import { serverClock } from './clock-offset'
import { RoomsError, rpcError } from './rooms-errors'
import type { MyRoom, RoomMode, RoomState } from './types'

export { RoomsError }

function requireClient() {
  if (!supabase) throw new RoomsError('Supabase non configuré')
  return supabase
}

// Les messages RPC (supabase/migrations/0029) sont déjà rédigés en français pour
// l'utilisateur final (raise exception) : rien à traduire, sauf les échecs réseau
// (« Failed to fetch »…), convertis par rpcError en message compréhensible.

function mapMyRoom(row: MyRoomRow): MyRoom {
  return {
    roomId: row.room_id,
    hostId: row.host_id,
    hostUsername: row.host_username,
    hostDisplayName: row.host_display_name,
    status: row.status,
    focusMinutes: row.focus_minutes,
    myStatus: row.my_status,
    participantCount: row.participant_count,
    createdAt: row.created_at,
    mode: row.mode,
    phase: row.phase,
    startedAt: row.started_at,
    durationMs: row.duration_ms,
    elapsedMsAtPause: row.elapsed_ms_at_pause,
  }
}

function mapRoomState(rows: RoomStateRow[], clockOffsetMs: number): RoomState | null {
  const first = rows[0]
  if (!first) return null
  return {
    roomId: first.room_id,
    hostId: first.host_id,
    status: first.status,
    focusMinutes: first.focus_minutes,
    mode: first.mode,
    shortBreakMinutes: first.short_break_minutes,
    longBreakMinutes: first.long_break_minutes,
    sessionsBeforeLongBreak: first.sessions_before_long_break,
    phase: first.phase,
    phaseIndex: first.phase_index,
    clockOffsetMs,
    updatedAt: first.room_updated_at ?? null,
    startedAt: first.started_at,
    durationMs: first.duration_ms,
    elapsedMsAtPause: first.elapsed_ms_at_pause,
    createdAt: first.created_at,
    endedAt: first.ended_at,
    participants: rows.map((row) => ({
      userId: row.participant_user_id,
      username: row.participant_username,
      displayName: row.participant_display_name,
      avatarUrl: row.participant_avatar_url,
      avatarVersion: row.participant_avatar_version,
      role: row.participant_role,
      status: row.participant_status,
      isPresent: row.participant_is_present,
    })),
  }
}

export async function listMyRooms(): Promise<MyRoom[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_my_rooms')
  if (error) throw rpcError(error.message)
  return (data ?? []).map(mapMyRoom)
}

export interface CreateRoomParams {
  mode: RoomMode
  /** Durée de focus (Pomodoro) ou du minuteur (Minuteur) ; ignorée en Chrono. */
  focusMinutes: number
  shortBreakMinutes?: number
  longBreakMinutes?: number
  sessionsBeforeLongBreak?: number
  friendIds: string[]
  /** Pilier rattaché à mes sessions de ce salon (XP via les focus_sessions). */
  pillarId?: string | null
}

export async function createRoom(params: CreateRoomParams): Promise<string> {
  const client = requireClient()
  const { data, error } = await client.rpc('create_room', {
    p_focus_minutes: params.mode === 'stopwatch' ? null : params.focusMinutes,
    p_friend_ids: params.friendIds,
    p_mode: params.mode,
    ...(params.mode === 'pomodoro'
      ? {
          p_short_break_minutes: params.shortBreakMinutes,
          p_long_break_minutes: params.longBreakMinutes,
          p_sessions_before_long_break: params.sessionsBeforeLongBreak,
        }
      : {}),
    p_pillar_id: params.pillarId ?? null,
  })
  if (error) throw rpcError(error.message)
  return data
}

export async function respondRoomInvite(
  roomId: string,
  accept: boolean,
  pillarId: string | null = null,
): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('respond_room_invite', {
    p_room_id: roomId,
    p_accept: accept,
    p_pillar_id: pillarId,
  })
  if (error) throw rpcError(error.message)
}

export async function setRoomPillar(roomId: string, pillarId: string | null): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('set_room_pillar', {
    p_room_id: roomId,
    p_pillar_id: pillarId,
  })
  if (error) throw rpcError(error.message)
}

export async function getRoomState(roomId: string): Promise<RoomState | null> {
  const client = requireClient()
  const sentAt = Date.now()
  const perfStart = performance.now()
  const { data, error } = await client.rpc('get_room_state', { p_room_id: roomId })
  const receivedAt = Date.now()
  const perfRttMs = performance.now() - perfStart
  if (error) throw rpcError(error.message)
  const rows = data ?? []
  // Écart d'horloge « à la NTP » (voir clock-offset.ts) : mesuré sur l'aller-retour, jamais
  // sur la seule heure de réception, que la latence des réponses fait varier.
  const serverNowMs = rows[0] ? new Date(rows[0].server_now).getTime() : Number.NaN
  const clockOffsetMs = Number.isNaN(serverNowMs)
    ? (serverClock.offsetMs ?? 0)
    : serverClock.addExchange({ sentAt, receivedAt, perfRttMs, serverNowMs })
  return mapRoomState(rows, clockOffsetMs)
}

export async function startRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('start_room', { p_room_id: roomId })
  if (error) throw rpcError(error.message)
}

export async function pauseRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('pause_room', { p_room_id: roomId })
  if (error) throw rpcError(error.message)
}

export async function resumeRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('resume_room', { p_room_id: roomId })
  if (error) throw rpcError(error.message)
}

export async function endRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('end_room', { p_room_id: roomId })
  if (error) throw rpcError(error.message)
}

export async function leaveRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('leave_room', { p_room_id: roomId })
  if (error) throw rpcError(error.message)
}

export async function transferHost(roomId: string, newHostId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('transfer_host', {
    p_room_id: roomId,
    p_new_host_id: newHostId,
  })
  if (error) throw rpcError(error.message)
}

/** Battement de cœur GLOBAL (migration 0048) : met à jour ma présence dans tous mes salons
 * non terminés, sans dépendre d'un écran de salon ouvert. */
export async function touchMyRooms(): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('touch_my_rooms')
  if (error) throw rpcError(error.message)
}
