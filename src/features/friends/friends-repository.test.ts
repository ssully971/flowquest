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
})
