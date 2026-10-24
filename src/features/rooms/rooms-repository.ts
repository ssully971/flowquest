import { supabase } from '@/shared/supabase/client'
import type { MyRoomRow, RoomStateRow } from '@/shared/supabase/database.types'

import type { MyRoom, RoomState } from './types'

export class RoomsError extends Error {}

function requireClient() {
  if (!supabase) throw new RoomsError('Supabase non configuré')
  return supabase
}

function translateRpcError(message: string): string {
  // Les messages RPC (supabase/migrations/0029) sont déjà rédigés en français pour
  // l'utilisateur final (raise exception) : rien à traduire, juste un filet par défaut.
  return message || 'Une erreur est survenue. Réessaie.'
}

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
  }
}

function mapRoomState(rows: RoomStateRow[]): RoomState | null {
  const first = rows[0]
  if (!first) return null
  return {
    roomId: first.room_id,
    hostId: first.host_id,
    status: first.status,
    focusMinutes: first.focus_minutes,
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
  if (error) throw new RoomsError(translateRpcError(error.message))
  return (data ?? []).map(mapMyRoom)
}

export async function createRoom(focusMinutes: number, friendIds: string[]): Promise<string> {
  const client = requireClient()
  const { data, error } = await client.rpc('create_room', {
    p_focus_minutes: focusMinutes,
    p_friend_ids: friendIds,
  })
  if (error) throw new RoomsError(translateRpcError(error.message))
  return data
}

export async function respondRoomInvite(roomId: string, accept: boolean): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('respond_room_invite', { p_room_id: roomId, p_accept: accept })
  if (error) throw new RoomsError(translateRpcError(error.message))
}

export async function getRoomState(roomId: string): Promise<RoomState | null> {
  const client = requireClient()
  const { data, error } = await client.rpc('get_room_state', { p_room_id: roomId })
  if (error) throw new RoomsError(translateRpcError(error.message))
  return mapRoomState(data ?? [])
}

export async function startRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('start_room', { p_room_id: roomId })
  if (error) throw new RoomsError(translateRpcError(error.message))
}

export async function pauseRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('pause_room', { p_room_id: roomId })
  if (error) throw new RoomsError(translateRpcError(error.message))
}

export async function resumeRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('resume_room', { p_room_id: roomId })
  if (error) throw new RoomsError(translateRpcError(error.message))
}

export async function endRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('end_room', { p_room_id: roomId })
  if (error) throw new RoomsError(translateRpcError(error.message))
}

export async function leaveRoom(roomId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('leave_room', { p_room_id: roomId })
  if (error) throw new RoomsError(translateRpcError(error.message))
}

export async function transferHost(roomId: string, newHostId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('transfer_host', { p_room_id: roomId, p_new_host_id: newHostId })
  if (error) throw new RoomsError(translateRpcError(error.message))
}
