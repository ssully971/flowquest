import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import type { RoomParticipant, RoomState } from '../types'
import { InviteToRoomDialog } from './InviteToRoomDialog'

const friendsMock = vi.fn()
vi.mock('@/features/friends/useFriends', () => ({ useFriends: () => friendsMock() }))

function friend(id: string, name: string) {
  return {
    id,
    username: name,
    displayName: name,
    avatarUrl: null,
    avatarVersion: 0,
    friendshipId: `f-${id}`,
    since: '2026-01-01',
    live: { state: null, startedAt: null, durationMs: null, isOnline: false },
  }
}

function participant(
  userId: string,
  status: RoomParticipant['status'],
  role: RoomParticipant['role'] = 'member',
) {
  return {
    userId,
    username: userId,
    displayName: userId,
    avatarUrl: null,
    avatarVersion: 0,
    role,
    status,
    isPresent: true,
  } satisfies RoomParticipant
}

function room(participants: RoomParticipant[]): RoomState {
  return {
    roomId: 'r1',
    hostId: 'host',
    status: 'running',
    focusMinutes: 25,
    mode: 'countdown',
    shortBreakMinutes: null,
    longBreakMinutes: null,
    sessionsBeforeLongBreak: null,
    phase: 'focus',
    phaseIndex: 0,
    startedAt: new Date().toISOString(),
    durationMs: 1_500_000,
    elapsedMsAtPause: null,
    createdAt: 'x',
    endedAt: null,
    clockOffsetMs: 0,
    participants,
  }
}

function setup(
  options: {
    participants?: RoomParticipant[]
    busy?: boolean
    onInvite?: () => Promise<boolean>
  } = {},
) {
  const onInvite = vi.fn(options.onInvite ?? (() => Promise.resolve(true)))
  const onClose = vi.fn()
  render(
    <ToastProvider>
      <InviteToRoomDialog
        room={room(
          options.participants ?? [
            participant('host', 'joined', 'host'),
            participant('ami-dedans', 'joined'),
          ],
        )}
        busy={options.busy ?? false}
        onInvite={onInvite}
        onClose={onClose}
      />
    </ToastProvider>,
  )
  return { onInvite, onClose }
}

beforeEach(() => {
  friendsMock.mockReset().mockReturnValue({
    friends: [
      friend('ami-dedans', 'Alice'),
      friend('ami-invite', 'Bruno'),
      friend('ami-libre', 'Chloé'),
      friend('ami-libre-2', 'David'),
    ],
    isLoading: false,
  })
})

describe('InviteToRoomDialog — inviter après coup', () => {
  it('liste les amis ; ceux déjà dans le salon ou invités sont grisés avec la raison', () => {
    setup({
      participants: [
        participant('host', 'joined', 'host'),
        participant('ami-dedans', 'joined'),
        participant('ami-invite', 'invited'),
      ],
    })
    expect(screen.getByRole('dialog', { name: 'Inviter dans le salon' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Alice/)).toBeDisabled()
    expect(screen.getByText('Dans le salon')).toBeInTheDocument()
    expect(screen.getByLabelText(/Bruno/)).toBeDisabled()
    expect(screen.getByText('Invité')).toBeInTheDocument()
    expect(screen.getByLabelText(/Chloé/)).toBeEnabled()
  })

  it('« Inviter » est désactivé sans sélection ; l’envoi transmet les amis choisis, puis ferme avec un toast', async () => {
    const user = userEvent.setup()
    const { onInvite, onClose } = setup()
    const submit = screen.getByRole('button', { name: 'Inviter' })
    expect(submit).toBeDisabled()

    await user.click(screen.getByLabelText(/Chloé/))
    await user.click(screen.getByLabelText(/David/))
    await user.click(submit)

    expect(onInvite).toHaveBeenCalledWith(['ami-libre', 'ami-libre-2'])
    expect(await screen.findByText('Invitations envoyées.')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('échec de l’envoi : la fenêtre reste ouverte (le message et Réessayer viennent de l’action du salon)', async () => {
    const user = userEvent.setup()
    const { onInvite, onClose } = setup({ onInvite: () => Promise.resolve(false) })
    await user.click(screen.getByLabelText(/Chloé/))
    await user.click(screen.getByRole('button', { name: 'Inviter' }))

    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByText('Invitation envoyée.')).not.toBeInTheDocument()
  })

  it('pendant l’envoi : bouton occupé « Envoi… », désactivé (jamais muet), Annuler verrouillé', () => {
    setup({ busy: true })
    const busy = screen.getByRole('button', { name: 'Envoi…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
  })

  it('respecte le plafond de 6 personnes : seules les places libres sont sélectionnables', async () => {
    const user = userEvent.setup()
    // Hôte + 4 membres = 5 : une seule place libre.
    setup({
      participants: [
        participant('host', 'joined', 'host'),
        participant('m1', 'joined'),
        participant('m2', 'joined'),
        participant('m3', 'invited'),
        participant('m4', 'invited'),
      ],
    })
    await user.click(screen.getByLabelText(/Chloé/))
    expect(screen.getByLabelText(/David/)).toBeDisabled()
  })

  it('salon complet : message clair, aucun sélecteur', () => {
    setup({
      participants: [
        participant('host', 'joined', 'host'),
        ...['a', 'b', 'c', 'd', 'e'].map((id) => participant(id, 'joined')),
      ],
    })
    expect(screen.getByRole('status')).toHaveTextContent('Le salon est complet')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('tous les amis déjà dans le salon : message clair', () => {
    friendsMock.mockReturnValue({ friends: [friend('ami-dedans', 'Alice')], isLoading: false })
    setup()
    expect(screen.getByRole('status')).toHaveTextContent('Tous tes amis sont déjà dans le salon')
  })

  it('Annuler ferme la fenêtre', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
