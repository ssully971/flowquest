import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SocialPanel } from './SocialPanel'

const useAuthMock = vi.fn()
const requestSignInMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/features/auth/useAuthGateRequest', () => ({
  useAuthGateRequest: () => ({ signInRequested: false, requestSignIn: requestSignInMock, clearSignInRequest: vi.fn() }),
}))

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
const MY_ROOM = {
  roomId: 'room1',
  hostId: 'host-1',
  hostUsername: 'hote',
  hostDisplayName: null,
  status: 'lobby' as const,
  focusMinutes: 25,
  myStatus: 'invited' as const,
  participantCount: 1,
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
  } as unknown as Parameters<typeof SocialPanel>[0]['friendsState']
}

function baseRoomsState(overrides: Record<string, unknown> = {}) {
  return {
    rooms: [MY_ROOM],
    isLoading: false,
    loadError: null,
    refresh: vi.fn(),
    create: vi.fn().mockResolvedValue('new-room'),
    respond: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as Parameters<typeof SocialPanel>[0]['roomsState']
}

function baseLeaderboardState(overrides: Record<string, unknown> = {}) {
  return {
    leaderboard: null,
    isLoading: false,
    loadError: null,
    weekOffset: 0 as const,
    setWeekOffset: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof SocialPanel>[0]['leaderboardState']
}

function baseDuoStreaksState(overrides: Record<string, unknown> = {}) {
  return {
    streaks: [],
    isLoading: false,
    loadError: null,
    refresh: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof SocialPanel>[0]['duoStreaksState']
}

function renderPanel(overrides: Partial<Parameters<typeof SocialPanel>[0]> = {}) {
  return render(
    <SocialPanel
      open
      onClose={vi.fn()}
      onOpenRoom={vi.fn()}
      friendsState={baseFriendsState()}
      leaderboardState={baseLeaderboardState()}
      duoStreaksState={baseDuoStreaksState()}
      roomsState={baseRoomsState()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    isSupabaseConfigured: true,
    profile: { friend_code: 'A3F7K9P2' },
  })
  requestSignInMock.mockReset()
})

describe('SocialPanel — point d’entrée social unique (LOT H2, §1)', () => {
  it('ne rend rien quand fermé', () => {
    render(
      <SocialPanel
        open={false}
        onClose={vi.fn()}
        onOpenRoom={vi.fn()}
        friendsState={baseFriendsState()}
        leaderboardState={baseLeaderboardState()}
        duoStreaksState={baseDuoStreaksState()}
        roomsState={baseRoomsState()}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('invite à se connecter si non authentifié', () => {
    useAuthMock.mockReturnValue({ status: 'guest', isSupabaseConfigured: true, profile: null })
    renderPanel()
    expect(screen.getByText(/Connecte-toi/)).toBeInTheDocument()
  })

  it('« Se connecter » (LOT H1, §3) rouvre l’écran de connexion existant', async () => {
    useAuthMock.mockReturnValue({ status: 'guest', isSupabaseConfigured: true, profile: null })
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(requestSignInMock).toHaveBeenCalled()
  })

  it('affiche la liste d’amis par défaut, avec le badge de demandes reçues', () => {
    renderPanel()
    expect(screen.getByText('Mon Ami')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Demandes/ })).toHaveTextContent('1')
  })

  it('l’onglet « Salons » affiche mes salons et porte le badge d’invitations en attente', async () => {
    const user = userEvent.setup()
    renderPanel()

    expect(screen.getByRole('tab', { name: /Salons/ })).toHaveTextContent('1')
    await user.click(screen.getByRole('tab', { name: /Salons/ }))
    expect(screen.getByText(/t’invite dans un salon/)).toBeInTheDocument()
  })

  it('l’onglet « Salons » > « Créer » affiche le formulaire de création', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('tab', { name: /Salons/ }))
    await user.click(screen.getByRole('tab', { name: 'Créer' }))
    expect(screen.getByLabelText('Durée exacte, en minutes')).toBeInTheDocument()
  })

  it('l’onglet « Classement » affiche LeaderboardTab', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('tab', { name: 'Classement' }))
    expect(screen.queryByText('Mon Ami')).not.toBeInTheDocument()
  })

  it('associe la série commune (LOT F4) de useDuoStreaks à l’ami correspondant', () => {
    renderPanel({
      duoStreaksState: baseDuoStreaksState({
        streaks: [{ friendId: 'u1', currentStreak: 4, longestStreak: 4, lastActiveDate: '2026-01-10', activeToday: false }],
      }),
    })
    expect(screen.getByTitle(/Série commune : 4/)).toBeInTheDocument()
  })

  it('bascule vers l’onglet Demandes, affiche la demande et l’accepte', async () => {
    const user = userEvent.setup()
    const friendsState = baseFriendsState()
    renderPanel({ friendsState })

    await user.click(screen.getByRole('tab', { name: /Demandes/ }))
    expect(screen.getByText('demandeur')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accepter' }))
    expect(friendsState.acceptRequest).toHaveBeenCalledWith('r1')
  })

  it('bascule vers l’onglet Ajouter et affiche le code ami', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('tab', { name: 'Ajouter' }))
    expect(screen.getByText('A3F7K9P2')).toBeInTheDocument()
  })

  it('état vide : liste d’amis vide affiche le message dédié', () => {
    renderPanel({ friendsState: baseFriendsState({ friends: [] }) })
    expect(screen.getByText(/Pas encore d’amis/)).toBeInTheDocument()
  })

  it('affiche une erreur de chargement des amis avec un bouton Réessayer', async () => {
    const user = userEvent.setup()
    const friendsState = baseFriendsState({ loadError: 'Impossible de charger tes amis. Réessaie.' })
    renderPanel({ friendsState })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(friendsState.refresh).toHaveBeenCalled()
  })

  it('le classement reste accessible même si les amis sont en erreur', async () => {
    const user = userEvent.setup()
    renderPanel({ friendsState: baseFriendsState({ loadError: 'Impossible de charger tes amis. Réessaie.' }) })

    await user.click(screen.getByRole('tab', { name: 'Classement' }))
    // Pas d'alerte du classement par défaut (loadError null dans baseLeaderboardState) :
    // seule celle des amis serait visible si les deux onglets étaient couplés.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rafraîchit mes salons à l’ouverture (une invitation reçue pendant que le panneau était fermé doit apparaître)', () => {
    const roomsState = baseRoomsState()
    const { rerender } = render(
      <SocialPanel
        open={false}
        onClose={vi.fn()}
        onOpenRoom={vi.fn()}
        friendsState={baseFriendsState()}
        leaderboardState={baseLeaderboardState()}
        duoStreaksState={baseDuoStreaksState()}
        roomsState={roomsState}
      />,
    )
    expect(roomsState.refresh).not.toHaveBeenCalled()

    rerender(
      <SocialPanel
        open
        onClose={vi.fn()}
        onOpenRoom={vi.fn()}
        friendsState={baseFriendsState()}
        leaderboardState={baseLeaderboardState()}
        duoStreaksState={baseDuoStreaksState()}
        roomsState={roomsState}
      />,
    )
    expect(roomsState.refresh).toHaveBeenCalled()
  })

  it('accepter une invitation de salon l’ouvre', async () => {
    const user = userEvent.setup()
    const roomsState = baseRoomsState()
    const onOpenRoom = vi.fn()
    renderPanel({ roomsState, onOpenRoom })

    await user.click(screen.getByRole('tab', { name: /Salons/ }))
    await user.click(screen.getByRole('button', { name: 'Accepter' }))

    expect(roomsState.respond).toHaveBeenCalledWith('room1', true)
    await vi.waitFor(() => expect(onOpenRoom).toHaveBeenCalledWith('room1'))
  })

  it('état vide : aucun salon affiche le message dédié', async () => {
    const user = userEvent.setup()
    renderPanel({ roomsState: baseRoomsState({ rooms: [] }) })

    await user.click(screen.getByRole('tab', { name: /Salons/ }))
    expect(screen.getByText(/Pas encore de salon/)).toBeInTheDocument()
  })

  it('affiche une erreur de chargement des salons avec un bouton Réessayer', async () => {
    const user = userEvent.setup()
    const roomsState = baseRoomsState({ loadError: 'Impossible de charger tes salons. Réessaie.' })
    renderPanel({ roomsState })

    await user.click(screen.getByRole('tab', { name: /Salons/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(roomsState.refresh).toHaveBeenCalled()
  })
})
