import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FriendsPanel } from './FriendsPanel'

const useAuthMock = vi.fn()
const useFriendsMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('../useFriends', () => ({ useFriends: () => useFriendsMock() }))

const FRIEND = {
  friendshipId: 'f1',
  id: 'u1',
  username: 'ami',
  displayName: 'Mon Ami',
  avatarUrl: null,
  avatarVersion: 0,
  since: '2026-01-01T00:00:00Z',
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

  it('affiche la liste d’amis par défaut, avec le badge de demandes reçues', () => {
    render(<FriendsPanel open onClose={vi.fn()} />)
    expect(screen.getByText('Mon Ami')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Demandes/ })).toHaveTextContent('1')
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
})
