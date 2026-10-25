import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RoomsPanel } from './RoomsPanel'

const useAuthMock = vi.fn()
const useFriendsMock = vi.fn()
const useRoomsMock = vi.fn()
const requestSignInMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/features/auth/useAuthGateRequest', () => ({
  useAuthGateRequest: () => ({ signInRequested: false, requestSignIn: requestSignInMock, clearSignInRequest: vi.fn() }),
}))
vi.mock('@/features/friends/useFriends', () => ({ useFriends: () => useFriendsMock() }))
vi.mock('../useRooms', () => ({ useRooms: () => useRoomsMock() }))

const MY_ROOM = {
  roomId: 'r1',
  hostId: 'host-1',
  hostUsername: 'hote',
  hostDisplayName: null,
  status: 'lobby' as const,
  focusMinutes: 25,
  myStatus: 'invited' as const,
  participantCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
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
  }
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated', isSupabaseConfigured: true })
  useFriendsMock.mockReturnValue({ friends: [] })
  useRoomsMock.mockReturnValue(baseRoomsState())
  requestSignInMock.mockReset()
})

describe('RoomsPanel — LOT F3', () => {
  it('ne rend rien quand fermé', () => {
    render(<RoomsPanel open={false} onClose={vi.fn()} onOpenRoom={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('invite à se connecter si non authentifié', () => {
    useAuthMock.mockReturnValue({ status: 'guest', isSupabaseConfigured: true })
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)
    expect(screen.getByText(/Connecte-toi/)).toBeInTheDocument()
  })

  it('« Se connecter » (LOT H1, §3) rouvre l’écran de connexion existant', async () => {
    useAuthMock.mockReturnValue({ status: 'guest', isSupabaseConfigured: true })
    const user = userEvent.setup()
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(requestSignInMock).toHaveBeenCalled()
  })

  it('affiche mes salons par défaut', () => {
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)
    expect(screen.getByText(/t’invite dans un salon/)).toBeInTheDocument()
  })

  it('rafraîchit mes salons à l’ouverture (une invitation reçue pendant que le panneau était fermé doit apparaître)', () => {
    const roomsState = baseRoomsState()
    useRoomsMock.mockReturnValue(roomsState)
    const { rerender } = render(<RoomsPanel open={false} onClose={vi.fn()} onOpenRoom={vi.fn()} />)
    expect(roomsState.refresh).not.toHaveBeenCalled()

    rerender(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)

    expect(roomsState.refresh).toHaveBeenCalled()
  })

  it('accepter une invitation ouvre le salon', async () => {
    const user = userEvent.setup()
    const roomsState = baseRoomsState()
    useRoomsMock.mockReturnValue(roomsState)
    const onOpenRoom = vi.fn()
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={onOpenRoom} />)

    await user.click(screen.getByRole('button', { name: 'Accepter' }))

    expect(roomsState.respond).toHaveBeenCalledWith('r1', true)
    await vi.waitFor(() => expect(onOpenRoom).toHaveBeenCalledWith('r1'))
  })

  it('bascule vers l’onglet Créer', async () => {
    const user = userEvent.setup()
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'Créer' }))

    expect(screen.getByRole('button', { name: 'Créer le salon' })).toBeInTheDocument()
  })

  it('état vide : aucun salon affiche le message dédié', () => {
    useRoomsMock.mockReturnValue(baseRoomsState({ rooms: [] }))
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)
    expect(screen.getByText(/Pas encore de salon/)).toBeInTheDocument()
  })

  it('affiche une erreur de chargement avec un bouton Réessayer', async () => {
    const user = userEvent.setup()
    const roomsState = baseRoomsState({ loadError: 'Impossible de charger tes salons. Réessaie.' })
    useRoomsMock.mockReturnValue(roomsState)
    render(<RoomsPanel open onClose={vi.fn()} onOpenRoom={vi.fn()} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(roomsState.refresh).toHaveBeenCalled()
  })
})
