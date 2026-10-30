import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ActivePillarProvider } from '@/features/pillars/ActivePillarProvider'
import { ActiveGroupRoomContext, INERT_ACTIVE_ROOM } from '@/features/rooms/active-room-context'
import type { ActiveGroupRoomValue } from '@/features/rooms/active-room-context'
import type { RoomClockView } from '@/features/rooms/room-timer'
import type { RoomParticipant, RoomState } from '@/features/rooms/types'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { ThemeProvider } from '@/shared/design-system'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { FocusScreen } from './FocusScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

function participant(overrides: Partial<RoomParticipant>): RoomParticipant {
  return {
    userId: 'u',
    username: 'u',
    displayName: null,
    avatarUrl: null,
    avatarVersion: 0,
    role: 'member',
    status: 'joined',
    isPresent: true,
    ...overrides,
  }
}

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomId: 'r1',
    hostId: 'host',
    status: 'running',
    focusMinutes: 25,
    mode: 'pomodoro',
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    phase: 'focus',
    phaseIndex: 0,
    startedAt: new Date().toISOString(),
    durationMs: 1_500_000,
    elapsedMsAtPause: null,
    createdAt: 'x',
    endedAt: null,
    clockOffsetMs: 0,
    participants: [
      participant({ userId: 'host', username: 'hote', displayName: 'Hôte', role: 'host' }),
      participant({ userId: 'me', username: 'moi', displayName: 'Moi' }),
      participant({ userId: 'away', username: 'absent', displayName: 'Absent', isPresent: false }),
    ],
    ...overrides,
  }
}

function view(overrides: Partial<RoomClockView> = {}): RoomClockView {
  return {
    status: 'running',
    phase: 'focus',
    phaseIndex: 0,
    durationMs: 1_500_000,
    elapsedMs: 300_000,
    remainingMs: 1_200_000,
    isOver: false,
    ...overrides,
  }
}

function groupValue(overrides: Partial<ActiveGroupRoomValue> = {}): ActiveGroupRoomValue {
  return {
    ...INERT_ACTIVE_ROOM,
    room: room(),
    view: view(),
    isHost: true,
    actions: {
      start: vi.fn().mockResolvedValue(true),
      pause: vi.fn().mockResolvedValue(true),
      resume: vi.fn().mockResolvedValue(true),
      end: vi.fn().mockResolvedValue(true),
      leave: vi.fn().mockResolvedValue(true),
      transfer: vi.fn().mockResolvedValue(true),
    },
    dismissEnded: vi.fn(),
    ...overrides,
  }
}

vi.mock('@/features/auth/useAuth', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/auth/useAuth')>('@/features/auth/useAuth')
  return {
    useAuth: () => ({ ...actual.useAuth(), user: { id: 'me' } }),
  }
})

function tree(value: ActiveGroupRoomValue) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <ActivePillarProvider>
              <TimerSettingsProvider>
                <ClockSettingsProvider>
                  <QuotesSettingsProvider>
                    <ExtrasSettingsProvider>
                      <ActiveGroupRoomContext.Provider value={value}>
                        <FocusScreen />
                      </ActiveGroupRoomContext.Provider>
                    </ExtrasSettingsProvider>
                  </QuotesSettingsProvider>
                </ClockSettingsProvider>
              </TimerSettingsProvider>
            </ActivePillarProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

beforeEach(async () => {
  const db = await getDb()
  await db.delete('timerState', 'current')
})

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('FocusScreen — la session de groupe remplace l’horloge solo (LOT M3)', () => {
  it('affiche l’horloge, la phase et les participants du salon à la place du minuteur personnel', async () => {
    render(tree(groupValue()))

    expect(await screen.findByText(/Session de groupe · Pomodoro/)).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/20:00/)
    expect(screen.getByText('Focus', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Hôte')).toBeInTheDocument()
    expect(screen.getByText('Absent')).toBeInTheDocument()
    expect(screen.getByText('parti')).toBeInTheDocument()
    // Plus de sélecteur de mode solo ni d'onglets de segment du minuteur personnel.
    expect(screen.queryByRole('radiogroup', { name: 'Mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Pause courte' })).not.toBeInTheDocument()
    expect(screen.getByText(/Ton minuteur personnel est en pause/)).toBeInTheDocument()
  })

  it('l’hôte pilote : mettre en pause, reprendre, terminer pour tous (avec confirmation)', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const value = groupValue()
    render(tree(value))

    await user.click(await screen.findByRole('button', { name: 'Mettre en pause' }))
    expect(value.actions.pause).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(value.actions.end).toHaveBeenCalledTimes(1)
  })

  it('un participant non hôte voit l’horloge en lecture seule et peut quitter', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const value = groupValue({ isHost: false })
    render(tree(value))

    expect(await screen.findByText('Seul l’hôte contrôle l’horloge.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lancer' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitter la session' }))
    expect(value.actions.leave).toHaveBeenCalledTimes(1)
  })

  it('salon en attente : « En attente de l’hôte », l’hôte peut démarrer', async () => {
    const user = userEvent.setup()
    const value = groupValue({
      room: room({ status: 'lobby', startedAt: null }),
      view: view({ status: 'lobby', elapsedMs: 0, remainingMs: 1_500_000 }),
      isHost: false,
    })
    const { rerender } = render(tree(value))
    expect(await screen.findByText('En attente de l’hôte')).toBeInTheDocument()

    const hostValue = { ...value, isHost: true }
    rerender(tree(hostValue))
    await user.click(await screen.findByRole('button', { name: 'Lancer' }))
    expect(hostValue.actions.start).toHaveBeenCalledTimes(1)
  })

  it('pause Pomodoro : la phase de pause est affichée', async () => {
    render(
      tree(
        groupValue({
          room: room({ phase: 'short_break', phaseIndex: 1 }),
          view: view({
            phase: 'short_break',
            phaseIndex: 1,
            durationMs: 300_000,
            elapsedMs: 60_000,
            remainingMs: 240_000,
          }),
        }),
      ),
    )
    expect(await screen.findByText('Pause courte', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/04:00/)
  })

  it('bascule solo → groupe → solo : le minuteur personnel est mis en pause puis revient', async () => {
    const user = userEvent.setup()
    const { rerender } = render(tree(INERT_ACTIVE_ROOM))

    // Solo : on lance le minuteur personnel.
    await user.click(await screen.findByRole('button', { name: 'Lancer' }))
    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()

    // Une session de groupe démarre : l'horloge de groupe prend la place.
    rerender(tree(groupValue({ isHost: false })))
    expect(await screen.findByText(/Session de groupe/)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Pause courte' })).not.toBeInTheDocument()

    // Fin de la session : l'horloge solo revient, en pause (jamais en train de tourner).
    rerender(tree(INERT_ACTIVE_ROOM))
    expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
    expect(screen.queryByText(/Session de groupe/)).not.toBeInTheDocument()
  })

  it('pendant la session de groupe, aucun contrôle du minuteur personnel n’est disponible', async () => {
    render(tree(groupValue({ isHost: false })))
    await screen.findByText(/Session de groupe/)
    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Passer' })).not.toBeInTheDocument()
  })

  it('écran de fin : la session terminée reste affichée jusqu’à sa fermeture', async () => {
    const user = userEvent.setup()
    const value = groupValue({ room: null, view: null, endedRoom: room({ status: 'ended' }) })
    render(tree(value))

    expect(await screen.findByText('Session terminée')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(value.dismissEnded).toHaveBeenCalledTimes(1)
  })

  it('se met à jour quand l’état du salon change (temps réel), sans rien rafraîchir', async () => {
    const { rerender } = render(tree(groupValue()))
    await screen.findByText(/Session de groupe/)
    expect(screen.getByRole('timer')).toHaveAccessibleName(/20:00/)

    await act(async () => {
      rerender(
        tree(
          groupValue({
            view: view({ elapsedMs: 600_000, remainingMs: 900_000 }),
          }),
        ),
      )
    })
    await waitFor(() => expect(screen.getByRole('timer')).toHaveAccessibleName(/15:00/))
  })
})

describe('FocusScreen — retour visuel des actions et connexion au salon (LOT P1)', () => {
  const listed = {
    roomId: 'r1',
    hostId: 'host',
    hostUsername: 'hote',
    hostDisplayName: 'Hôte',
    status: 'running' as const,
    focusMinutes: 25,
    myStatus: 'joined' as const,
    participantCount: 3,
    createdAt: 'x',
    mode: 'pomodoro' as const,
    phase: 'focus' as const,
    startedAt: null,
    durationMs: 1_500_000,
    elapsedMsAtPause: null,
  }

  it('salon en cours de chargement : écran « Connexion au salon… » tout de suite, jamais l’horloge solo', async () => {
    render(tree(groupValue({ room: null, view: null, connecting: listed })))

    expect(await screen.findByText('Connexion au salon…')).toBeInTheDocument()
    expect(screen.getByText(/Session de groupe · Pomodoro/)).toBeInTheDocument()
    expect(screen.getByText(/En cours · Focus · 3 participants/)).toBeInTheDocument()
    expect(screen.getByTestId('group-clock-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('échec du chargement : message clair et bouton Réessayer', async () => {
    const retryLoad = vi.fn()
    const user = userEvent.setup()
    render(
      tree(
        groupValue({
          room: null,
          view: null,
          connecting: listed,
          loadError: 'Le serveur met du temps à répondre.',
          retryLoad,
        }),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le serveur met du temps à répondre.',
    )
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(retryLoad).toHaveBeenCalledTimes(1)
  })

  it('action en cours : boutons désactivés, libellé « Lancement… », jamais de bouton muet', async () => {
    render(
      tree(
        groupValue({
          room: room({ status: 'lobby', startedAt: null, durationMs: null }),
          view: view({ status: 'lobby', elapsedMs: 0, remainingMs: 1_500_000 }),
          pendingAction: 'start',
        }),
      ),
    )

    const primary = await screen.findByRole('button', { name: 'Lancement…' })
    expect(primary).toBeDisabled()
    expect(primary).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByText('Lancement…').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Quitter la session' })).toBeDisabled()
    for (const button of screen.getAllByRole('button', { name: 'Nommer hôte' })) {
      expect(button).toBeDisabled()
    }
  })

  it('échec d’une action : message, Réessayer relance l’action, Masquer ferme le message', async () => {
    const retry = vi.fn()
    const dismissActionError = vi.fn()
    const user = userEvent.setup()
    render(
      tree(
        groupValue({
          actionError: {
            action: 'pause',
            kind: 'network',
            message: 'Connexion impossible. Vérifie ta connexion internet puis réessaie.',
            retry,
          },
          dismissActionError,
        }),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible.')
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(retry).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Masquer le message' }))
    expect(dismissActionError).toHaveBeenCalledTimes(1)
  })
})
