import type { CheerEmoji, LiveState } from '@/shared/supabase/database.types'

export interface FriendProfilePreview {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarVersion: number
}

export interface LiveStatusInfo {
  state: LiveState | null
  startedAt: string | null
  durationMs: number | null
  isOnline: boolean
}

export interface Friend extends FriendProfilePreview {
  friendshipId: string
  since: string
  live: LiveStatusInfo
}

export type FriendRequestDirection = 'incoming' | 'outgoing'

export interface FriendRequest extends FriendProfilePreview {
  friendshipId: string
  direction: FriendRequestDirection
  createdAt: string
}

export interface UnreadCheer {
  id: string
  emoji: CheerEmoji
  createdAt: string
  sender: FriendProfilePreview
}

export interface LeaderboardEntry extends FriendProfilePreview {
  rank: number
  isSelf: boolean
  score: number
  focusSeconds: number
  completionRate: number
  regularityRate: number
}

export interface Leaderboard {
  entries: LeaderboardEntry[]
  weekStart: string
  weekEnd: string
}

export type { CheerEmoji }
