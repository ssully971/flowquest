export interface FriendProfilePreview {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarVersion: number
}

export interface Friend extends FriendProfilePreview {
  friendshipId: string
  since: string
}

export type FriendRequestDirection = 'incoming' | 'outgoing'

export interface FriendRequest extends FriendProfilePreview {
  friendshipId: string
  direction: FriendRequestDirection
  createdAt: string
}
