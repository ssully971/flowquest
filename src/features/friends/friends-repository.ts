import { supabase } from '@/shared/supabase/client'
import type {
  CheerEmoji,
  DuoStreakRow,
  FriendProfilePreviewRow,
  FriendRequestRow,
  FriendRow,
  LeaderboardRow,
  UnreadCheerRow,
} from '@/shared/supabase/database.types'

import type { DuoStreak, Friend, FriendProfilePreview, FriendRequest, Leaderboard, UnreadCheer } from './types'

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
  return {
    ...mapPreview(row),
    friendshipId: row.friendship_id,
    since: row.since,
    live: {
      state: row.live_state,
      startedAt: row.live_started_at,
      durationMs: row.live_duration_ms,
      isOnline: row.live_is_online,
    },
  }
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

function mapUnreadCheer(row: UnreadCheerRow): UnreadCheer {
  return {
    id: row.id,
    emoji: row.emoji,
    createdAt: row.created_at,
    sender: {
      id: row.sender_id,
      username: row.sender_username,
      displayName: row.sender_display_name,
      avatarUrl: row.sender_avatar_url,
      avatarVersion: row.sender_avatar_version,
    },
  }
}

export async function sendCheer(recipientId: string, emoji: CheerEmoji): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('send_cheer', { p_recipient_id: recipientId, p_emoji: emoji })
  if (error) throw new FriendsError(translateRpcError(error.message))
}

export async function listUnreadCheers(): Promise<UnreadCheer[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_unread_cheers')
  if (error) throw new FriendsError(translateRpcError(error.message))
  return (data ?? []).map(mapUnreadCheer)
}

export async function markCheersRead(): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('mark_cheers_read')
  if (error) throw new FriendsError(translateRpcError(error.message))
}

function mapLeaderboardRow(row: LeaderboardRow): Leaderboard['entries'][number] {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    avatarVersion: row.avatar_version,
    rank: row.leaderboard_rank,
    isSelf: row.is_self,
    score: row.score,
    focusSeconds: row.focus_seconds,
    completionRate: row.completion_rate,
    regularityRate: row.regularity_rate,
  }
}

/** p_week_offset : 0 = semaine en cours, 1 = semaine précédente (seules valeurs acceptées
 * par weekly_leaderboard(), migration 0027). */
export async function fetchWeeklyLeaderboard(weekOffset: 0 | 1): Promise<Leaderboard> {
  const client = requireClient()
  const { data, error } = await client.rpc('weekly_leaderboard', { p_week_offset: weekOffset })
  if (error) throw new FriendsError(translateRpcError(error.message))
  const rows = data ?? []
  return {
    entries: rows.map(mapLeaderboardRow),
    weekStart: rows[0]?.week_start ?? '',
    weekEnd: rows[0]?.week_end ?? '',
  }
}

function mapDuoStreak(row: DuoStreakRow): DuoStreak {
  return {
    friendId: row.friend_id,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActiveDate: row.last_active_date,
    activeToday: row.active_today,
  }
}

export async function listDuoStreaks(): Promise<DuoStreak[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_duo_streaks')
  if (error) throw new FriendsError(translateRpcError(error.message))
  return (data ?? []).map(mapDuoStreak)
}
