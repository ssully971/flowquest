import { supabase } from '@/shared/supabase/client'
import type { FriendProfilePreviewRow, FriendRequestRow, FriendRow } from '@/shared/supabase/database.types'

import type { Friend, FriendProfilePreview, FriendRequest } from './types'

export class FriendsError extends Error {}

function requireClient() {
  if (!supabase) throw new FriendsError('Supabase non configuré')
  return supabase
}

function mapPreview(row: FriendProfilePreviewRow): FriendProfilePreview {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    avatarVersion: row.avatar_version,
  }
}

function mapFriend(row: FriendRow): Friend {
  return { ...mapPreview(row), friendshipId: row.friendship_id, since: row.since }
}

function mapRequest(row: FriendRequestRow): FriendRequest {
  return {
    ...mapPreview(row),
    friendshipId: row.friendship_id,
    direction: row.direction,
    createdAt: row.created_at,
  }
}

function translateRpcError(message: string): string {
  // Les messages RPC (supabase/migrations/0021-0023) sont déjà rédigés en français pour
  // l'utilisateur final (raise exception) : rien à traduire, juste un filet par défaut.
  return message || 'Une erreur est survenue. Réessaie.'
}

export async function listFriends(): Promise<Friend[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_friends')
  if (error) throw new FriendsError(translateRpcError(error.message))
  return (data ?? []).map(mapFriend)
}

export async function listFriendRequests(): Promise<FriendRequest[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_friend_requests')
  if (error) throw new FriendsError(translateRpcError(error.message))
  return (data ?? []).map(mapRequest)
}

export async function findProfilePreview(
  query: { code: string } | { username: string },
): Promise<FriendProfilePreview | null> {
  const client = requireClient()
  const { data, error } = await client.rpc('find_profile_preview', {
    p_code: 'code' in query ? query.code : null,
    p_username: 'username' in query ? query.username : null,
  })
  if (error) throw new FriendsError(translateRpcError(error.message))
  const row = data?.[0]
  return row ? mapPreview(row) : null
}

export async function sendFriendRequest(query: { code: string } | { username: string }): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('send_friend_request', {
    p_code: 'code' in query ? query.code : null,
    p_username: 'username' in query ? query.username : null,
  })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('respond_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('cancel_friend_request', { p_friendship_id: friendshipId })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function removeFriend(otherUserId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('remove_friend', { p_other_user_id: otherUserId })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function blockUser(otherUserId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('block_user', { p_other_user_id: otherUserId })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function unblockUser(otherUserId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('unblock_user', { p_other_user_id: otherUserId })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function regenerateFriendCode(): Promise<string> {
  const client = requireClient()
  const { data, error } = await client.rpc('regenerate_friend_code')
  if (error) throw new FriendsError(translateRpcError(error.message))
  return data
}

export async function reportUser(targetUserId: string, reason: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('report_user', { p_target_user_id: targetUserId, p_reason: reason })
  if (error) throw new FriendsError(translateRpcError(error.message))
}
