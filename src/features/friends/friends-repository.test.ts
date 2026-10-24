import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('friends-repository — appels RPC et mise en forme (LOT F1)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('listFriends appelle list_friends et met les colonnes en camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          friendship_id: 'f1',
          id: 'u1',
          username: 'ami',
          display_name: 'Ami',
          avatar_url: 'https://x/a.webp',
          avatar_version: 2,
          since: '2026-01-01T00:00:00Z',
          live_state: 'focus',
          live_started_at: '2026-01-02T00:00:00Z',
          live_duration_ms: 1500000,
          live_is_online: true,
        },
      ],
      error: null,
    })
    const { listFriends } = await import('./friends-repository')

    const result = await listFriends()

    expect(rpcMock).toHaveBeenCalledWith('list_friends')
    expect(result).toEqual([
      {
        friendshipId: 'f1',
        id: 'u1',
        username: 'ami',
        displayName: 'Ami',
        avatarUrl: 'https://x/a.webp',
        avatarVersion: 2,
        since: '2026-01-01T00:00:00Z',
        live: {
          state: 'focus',
          startedAt: '2026-01-02T00:00:00Z',
          durationMs: 1500000,
          isOnline: true,
        },
      },
    ])
  })

  it('listFriendRequests sépare les demandes par direction', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          friendship_id: 'f1',
          direction: 'incoming',
          id: 'u1',
          username: 'a',
          display_name: null,
          avatar_url: null,
          avatar_version: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          friendship_id: 'f2',
          direction: 'outgoing',
          id: 'u2',
          username: 'b',
          display_name: null,
          avatar_url: null,
          avatar_version: 0,
          created_at: '2026-01-02T00:00:00Z',
        },
      ],
      error: null,
    })
    const { listFriendRequests } = await import('./friends-repository')

    const result = await listFriendRequests()

    expect(result.map((r) => r.direction)).toEqual(['incoming', 'outgoing'])
  })

  it('sendFriendRequest par code envoie p_code et p_username=null', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { sendFriendRequest } = await import('./friends-repository')

    await sendFriendRequest({ code: 'ABCD1234' })

    expect(rpcMock).toHaveBeenCalledWith('send_friend_request', { p_code: 'ABCD1234', p_username: null })
  })

  it('sendFriendRequest par pseudo envoie p_username et p_code=null', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { sendFriendRequest } = await import('./friends-repository')

    await sendFriendRequest({ username: 'ssully' })

    expect(rpcMock).toHaveBeenCalledWith('send_friend_request', { p_code: null, p_username: 'ssully' })
  })

  it('findProfilePreview renvoie null quand la recherche ne trouve personne', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { findProfilePreview } = await import('./friends-repository')

    expect(await findProfilePreview({ username: 'inconnu' })).toBeNull()
  })

  it('propage le message d’erreur du serveur (ex. quota, compte introuvable)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Compte introuvable' } })
    const { sendFriendRequest, FriendsError } = await import('./friends-repository')

    await expect(sendFriendRequest({ username: 'x' })).rejects.toThrow(FriendsError)
    await expect(sendFriendRequest({ username: 'x' })).rejects.toThrow('Compte introuvable')
  })

  it('respondFriendRequest(accept) appelle respond_friend_request avec p_accept=true', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { respondFriendRequest } = await import('./friends-repository')

    await respondFriendRequest('f1', true)

    expect(rpcMock).toHaveBeenCalledWith('respond_friend_request', { p_friendship_id: 'f1', p_accept: true })
  })

  it('blockUser et unblockUser appellent les bonnes RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { blockUser, unblockUser } = await import('./friends-repository')

    await blockUser('u1')
    await unblockUser('u1')

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'block_user', { p_other_user_id: 'u1' })
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'unblock_user', { p_other_user_id: 'u1' })
  })

  it('reportUser appelle report_user avec la cible et la raison', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { reportUser } = await import('./friends-repository')

    await reportUser('u1', 'Comportement déplacé')

    expect(rpcMock).toHaveBeenCalledWith('report_user', {
      p_target_user_id: 'u1',
      p_reason: 'Comportement déplacé',
    })
  })

  it('regenerateFriendCode renvoie le nouveau code', async () => {
    rpcMock.mockResolvedValue({ data: 'A3F7K9P2', error: null })
    const { regenerateFriendCode } = await import('./friends-repository')

    expect(await regenerateFriendCode()).toBe('A3F7K9P2')
  })

  it('sendCheer appelle send_cheer avec le destinataire et l’emoji', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { sendCheer } = await import('./friends-repository')

    await sendCheer('u1', '🔥')

    expect(rpcMock).toHaveBeenCalledWith('send_cheer', { p_recipient_id: 'u1', p_emoji: '🔥' })
  })

  it('listUnreadCheers met en forme l’expéditeur de chaque encouragement', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'c1',
          emoji: '💪',
          created_at: '2026-01-01T00:00:00Z',
          sender_id: 'u2',
          sender_username: 'ami',
          sender_display_name: 'Ami',
          sender_avatar_url: null,
          sender_avatar_version: 0,
        },
      ],
      error: null,
    })
    const { listUnreadCheers } = await import('./friends-repository')

    const result = await listUnreadCheers()

    expect(rpcMock).toHaveBeenCalledWith('list_unread_cheers')
    expect(result).toEqual([
      {
        id: 'c1',
        emoji: '💪',
        createdAt: '2026-01-01T00:00:00Z',
        sender: {
          id: 'u2',
          username: 'ami',
          displayName: 'Ami',
          avatarUrl: null,
          avatarVersion: 0,
        },
      },
    ])
  })

  it('markCheersRead appelle mark_cheers_read', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { markCheersRead } = await import('./friends-repository')

    await markCheersRead()

    expect(rpcMock).toHaveBeenCalledWith('mark_cheers_read')
  })

  it('fetchWeeklyLeaderboard appelle weekly_leaderboard avec le décalage de semaine et met en forme le classement', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          leaderboard_rank: 1,
          id: 'u1',
          username: 'moi',
          display_name: null,
          avatar_url: null,
          avatar_version: 0,
          is_self: true,
          score: 85,
          focus_seconds: 7200,
          completion_rate: 90,
          regularity_rate: 80,
          week_start: '2026-01-05T04:00:00Z',
          week_end: '2026-01-12T04:00:00Z',
        },
      ],
      error: null,
    })
    const { fetchWeeklyLeaderboard } = await import('./friends-repository')

    const result = await fetchWeeklyLeaderboard(0)

    expect(rpcMock).toHaveBeenCalledWith('weekly_leaderboard', { p_week_offset: 0 })
    expect(result).toEqual({
      weekStart: '2026-01-05T04:00:00Z',
      weekEnd: '2026-01-12T04:00:00Z',
      entries: [
        {
          id: 'u1',
          username: 'moi',
          displayName: null,
          avatarUrl: null,
          avatarVersion: 0,
          rank: 1,
          isSelf: true,
          score: 85,
          focusSeconds: 7200,
          completionRate: 90,
          regularityRate: 80,
        },
      ],
    })
  })

  it('listDuoStreaks appelle list_duo_streaks et met les colonnes en camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          friend_id: 'u1',
          username: 'ami',
          display_name: 'Ami',
          avatar_url: null,
          avatar_version: 0,
          current_streak: 5,
          longest_streak: 9,
          last_active_date: '2026-01-10',
          active_today: true,
        },
      ],
      error: null,
    })
    const { listDuoStreaks } = await import('./friends-repository')

    const result = await listDuoStreaks()

    expect(rpcMock).toHaveBeenCalledWith('list_duo_streaks')
    expect(result).toEqual([
      {
        friendId: 'u1',
        currentStreak: 5,
        longestStreak: 9,
        lastActiveDate: '2026-01-10',
        activeToday: true,
      },
    ])
  })
})
