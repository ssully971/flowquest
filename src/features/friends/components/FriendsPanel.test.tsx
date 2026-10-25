import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FriendsPanel } from './FriendsPanel'

const useAuthMock = vi.fn()
const useFriendsMock = vi.fn()
const useDuoStreaksMock = vi.fn()
const requestSignInMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/features/auth/useAuthGateRequest', () => ({
  useAuthGateRequest: () => ({ signInRequested: false, requestSignIn: requestSignInMock, clearSignInRequest: vi.fn() }),
}))
vi.mock('../useFriends', () => ({ useFriends: () => useFriendsMock() }))
vi.mock('../useDuoStreaks', () => ({ useDuoStreaks: () => useDuoStreaksMock() }))

const FRIEND = {
  friendshipId: 'f1',
  id: 'u1',
  username: 'ami',
  displayName: 'Mon Ami',
  avatarUrl: null,
  avatarVersion: 0,
  since: '2026-01-01T00:00:00Z',
  live: { state: null, startedAt: null, durationMs: null, isOnline: false },
}
const INCOMING = {
  friendshipId: 'r1',
  direction: 'incoming' as const,
  id: 'u2',
  username: 'demandeur',
  displayName: null,
  avatarUrl: null,
  avatarVersion: 0,
  createdAt: '2026-01-01T00:00:00Z',
}

function baseFriendsState(overrides: Record<string, unknown> = {}) {
  return {
    friends: [FRIEND],
    incomingRequests: [INCOMING],
    outgoingRequests: [],
    isLoading: false,
    loadError: null,
    refresh: vi.fn(),
    addByCode: vi.fn().mockResolvedValue(true),
    addByUsername: vi.fn().mockResolvedValue(true),
    preview: vi.fn().mockResolvedValue(null),
    acceptRequest: vi.fn().mockResolvedValue(true),
    declineRequest: vi.fn().mockResolvedValue(true),
    cancelRequest: vi.fn().mockResolvedValue(true),
    unfriend: vi.fn().mockResolvedValue(true),
    block: vi.fn().mockResolvedValue(true),
    unblock: vi.fn().mockResolvedValue(true),
    report: vi.fn().mockResolvedValue(true),
    regenerateCode: vi.fn().mockResolvedValue('NEWCODE1'),
    cheer: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    isSupabaseConfigured: true,
    profile: { friend_code: 'A3F7K9P2' },
  })
  useFriendsMock.mockReturnValue(baseFriendsState())
  useDuoStreaksMock.mockReturnValue({ streaks: [], isLoading: false, loadError: null, refresh: vi.fn() })
  requestSignInMock.mockReset()
})

describe('FriendsPanel — onglet principal Amis (LOT F1)', () => {
  it('ne rend rien quand fermé', () => {
    render(<FriendsPanel open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('invite à se connecter si non authentifié', () => {
    useAuthMock.mockReturnValue({ status: 'guest', isSupabaseConfigured: true, profile: null })
    render(<FriendsPanel open onClose={vi.fn()} />)
    expect(screen.getByText(/Connecte-toi/)).toBeInTheDocument()
  })

  it('« Se connecter » (LOT H1, §3) rouvre l’écran de connexion existant', async () => {
    useAuthMock.mockReturnValue({ status: 'guest', isSupabaseConfigured: true, profile: null })
    const user = userEvent.setup()
    render(<FriendsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(requestSignInMock).toHaveBeenCalled()
  })

  it('affiche la liste d’amis par défaut, avec le badge de demandes reçues', () => {
    render(<FriendsPanel open onClose={vi.fn()} />)
    expect(screen.getByText('Mon Ami')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Demandes/ })).toHaveTextContent('1')
  })

  it('associe la série commune (LOT F4) de useDuoStreaks à l’ami correspondant', () => {
    useDuoStreaksMock.mockReturnValue({
      streaks: [{ friendId: 'u1', currentStreak: 4, longestStreak: 4, lastActiveDate: '2026-01-10', activeToday: false }],
      isLoading: false,
      loadError: null,
      refresh: vi.fn(),
    })
    render(<FriendsPanel open onClose={vi.fn()} />)
    expect(screen.getByTitle(/Série commune : 4/)).toBeInTheDocument()
  })

  it('bascule vers l’onglet Demandes et affiche la demande reçue', async () => {
    const user = userEvent.setup()
    render(<FriendsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: /Demandes/ }))

    expect(screen.getByText('demandeur')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accepter' })).toBeInTheDocument()
  })

  it('accepter une demande appelle acceptRequest avec le bon id', async () => {
    const user = userEvent.setup()
    const friendsState = baseFriendsState()
    useFriendsMock.mockReturnValue(friendsState)
    render(<FriendsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: /Demandes/ }))
    await user.click(screen.getByRole('button', { name: 'Accepter' }))

    expect(friendsState.acceptRequest).toHaveBeenCalledWith('r1')
  })

  it('bascule vers l’onglet Ajouter et affiche le code ami', async () => {
    const user = userEvent.setup()
    render(<FriendsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'Ajouter' }))

    expect(screen.getByText('A3F7K9P2')).toBeInTheDocument()
  })

  it('état vide : liste d’amis vide affiche le message dédié', () => {
    useFriendsMock.mockReturnValue(baseFriendsState({ friends: [] }))
    render(<FriendsPanel open onClose={vi.fn()} />)
    expect(screen.getByText(/Pas encore d’amis/)).toBeInTheDocument()
  })

  it('affiche une erreur de chargement avec un bouton Réessayer', async () => {
    const user = userEvent.setup()
    const friendsState = baseFriendsState({ loadError: 'Impossible de charger tes amis. Réessaie.' })
    useFriendsMock.mockReturnValue(friendsState)
    render(<FriendsPanel open onClose={vi.fn()} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(friendsState.refresh).toHaveBeenCalled()
  })

  it('bascule vers l’onglet Classement, indépendant de l’état de chargement des amis', async () => {
    const user = userEvent.setup()
    // Même si les amis sont en erreur, le classement (chargement/erreur séparés via
    // useLeaderboard) doit rester accessible.
    useFriendsMock.mockReturnValue(baseFriendsState({ loadError: 'Impossible de charger tes amis. Réessaie.' }))
    render(<FriendsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'Classement' }))

    // Pas de Supabase configuré dans ce test : useLeaderboard tombe sur son propre état
    // d'erreur, distinct de celui des amis — preuve que les deux ne sont pas couplés.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
