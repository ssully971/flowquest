import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AppMode } from '@/app/useAppMode'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ActiveGroupRoomContext, INERT_ACTIVE_ROOM } from '@/features/rooms/active-room-context'
import type { ActiveGroupRoomValue } from '@/features/rooms/active-room-context'
import type { MyRoom } from '@/features/rooms/types'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { BackgroundDisplaySettingsProvider } from '@/features/settings/BackgroundDisplaySettingsProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { getActiveTaskId } from '@/features/tasks/active-task-ref'
import {
  requestFocusOnTask,
  requestOpenTasks,
  takePendingFocusRequest,
} from '@/features/tasks/panel-requests'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AppShell } from './AppShell'

function renderAppShell(
  children: ReactNode,
  mode: AppMode = 'home',
  onModeChange: (mode: AppMode) => void = vi.fn(),
) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <TimerSettingsProvider>
              <ClockSettingsProvider>
                <QuotesSettingsProvider>
                  <ExtrasSettingsProvider>
                    <BackgroundDisplaySettingsProvider>
                      <AppShell mode={mode} onModeChange={onModeChange}>
                        {children}
                      </AppShell>
                    </BackgroundDisplaySettingsProvider>
                  </ExtrasSettingsProvider>
                </QuotesSettingsProvider>
              </ClockSettingsProvider>
            </TimerSettingsProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

afterEach(() => {
  window.localStorage.clear()
})

describe('AppShell — mise en page en calques (pas de décalage par la barre du bas)', () => {
  it('le contenu occupe tout le conteneur (absolute inset-0) indépendamment de la barre du bas', () => {
    renderAppShell(<div data-testid="content">Contenu</div>)

    const content = screen.getByTestId('content')
    const contentWrapper = content.parentElement
    expect(contentWrapper?.className).toContain('absolute')
    expect(contentWrapper?.className).toContain('inset-0')
  })

  it('la barre du bas est superposée (absolute, bottom-0), pas en flux normal', () => {
    renderAppShell(<div>Contenu</div>)

    const settingsButton = screen.getByRole('button', { name: 'Réglages' })
    const bottomBar = settingsButton.closest('div[class*="absolute"][class*="bottom-0"]')
    expect(bottomBar).not.toBeNull()
  })

  it('le conteneur racine utilise 100dvh (suit la barre d’outils Safari en temps réel, lot 3 : plus de bande vide quand elle se masque)', () => {
    const { container } = renderAppShell(<div>Contenu</div>)
    expect(container.firstElementChild?.className).toContain('h-dvh')
  })
})

describe('AppShell — Réglages et Plein écran à gauche, Tâches/Notes à droite', () => {
  it('Réglages et Plein écran sont groupés ensemble à gauche de la barre du bas', () => {
    renderAppShell(<div>Contenu</div>)

    const leftGroup = screen.getByTestId('left-button-group')
    const childLabels = Array.from(leftGroup.querySelectorAll('[aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(childLabels).toEqual(['Réglages', 'Plein écran'])
  })

  it('Tâches et Bloc-notes sont dans le groupe de droite (LOT H2, §1 : Amis/Salons retirés, voir la carte profil)', () => {
    renderAppShell(<div>Contenu</div>)

    const rightGroup = screen.getByTestId('right-button-group')
    const labels = Array.from(rightGroup.querySelectorAll('[aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(labels.slice(-2)).toEqual(['Tâches', 'Bloc-notes'])
    expect(labels).not.toContain('Amis')
    expect(labels).not.toContain('Salons')
  })

  it('Réglages se déplace dans le groupe de droite quand Extras le règle sur « Droite » (LOT B9)', () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, settingsPanelSide: 'right' }),
    )
    renderAppShell(<div>Contenu</div>)

    const leftGroup = screen.getByTestId('left-button-group')
    const leftLabels = Array.from(leftGroup.querySelectorAll('[aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(leftLabels).toEqual(['Plein écran'])

    const rightGroup = screen.getByTestId('right-button-group')
    const rightLabels = Array.from(rightGroup.querySelectorAll('[aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(rightLabels[0]).toBe('Réglages')
  })
})

describe('AppShell — pastille de série (lot 4 : panneau de détail)', () => {
  it('ouvre le panneau de détail de la série au clic sur la pastille', async () => {
    const user = userEvent.setup()
    renderAppShell(<div>Contenu</div>)

    const streakButton = screen.getByRole('button', { name: /Série/ })
    expect(screen.queryByRole('dialog', { name: 'Série' })).not.toBeInTheDocument()

    await user.click(streakButton)
    expect(screen.getByRole('dialog', { name: 'Série' })).toBeInTheDocument()
  })
})

describe('AppShell — mode Ambiant (§5.3) : tâches et bloc-notes masqués', () => {
  it('propose Ambiant dans le sélecteur de mode', () => {
    renderAppShell(<div>Contenu</div>)
    expect(screen.getByRole('radio', { name: 'Ambiant' })).toBeInTheDocument()
  })

  it('masque les boutons Tâches et Bloc-notes en mode Ambiant', () => {
    renderAppShell(<div>Contenu</div>, 'ambient')

    expect(screen.queryByRole('button', { name: 'Tâches' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bloc-notes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeInTheDocument()
  })
})

describe('AppShell — invitations visibles partout et session de groupe (LOT M3/M4)', () => {
  function renderWithRooms(rooms: MyRoom[], onModeChange = vi.fn()) {
    const respond = vi.fn().mockResolvedValue(true)
    const value: ActiveGroupRoomValue = {
      ...INERT_ACTIVE_ROOM,
      roomsState: { ...INERT_ACTIVE_ROOM.roomsState, rooms, respond },
    }
    render(
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ActiveTaskProvider>
              <TimerSettingsProvider>
                <ClockSettingsProvider>
                  <QuotesSettingsProvider>
                    <ExtrasSettingsProvider>
                      <BackgroundDisplaySettingsProvider>
                        <ActiveGroupRoomContext.Provider value={value}>
                          <AppShell mode="home" onModeChange={onModeChange}>
                            <div>Contenu</div>
                          </AppShell>
                        </ActiveGroupRoomContext.Provider>
                      </BackgroundDisplaySettingsProvider>
                    </ExtrasSettingsProvider>
                  </QuotesSettingsProvider>
                </ClockSettingsProvider>
              </TimerSettingsProvider>
            </ActiveTaskProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>,
    )
    return { respond, onModeChange }
  }

  const INVITE: MyRoom = {
    roomId: 'r1',
    hostId: 'h',
    hostUsername: 'hote',
    hostDisplayName: 'Hôte',
    status: 'lobby',
    focusMinutes: 25,
    myStatus: 'invited',
    participantCount: 1,
    createdAt: '2026-01-01T10:00:00Z',
    mode: 'countdown',
    phase: 'focus',
    startedAt: null,
    durationMs: null,
    elapsedMsAtPause: null,
  }

  it('une invitation à un salon s’affiche en bannière, où que l’on soit, sans ouvrir le mode amis', async () => {
    const user = userEvent.setup()
    const { respond, onModeChange } = renderWithRooms([INVITE])

    expect(screen.getByText(/t’invite à un salon de focus/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }))

    expect(respond).toHaveBeenCalledWith('r1', true)
    // Rejoindre emmène directement à l'horloge de groupe (écran Focus).
    await vi.waitFor(() => expect(onModeChange).toHaveBeenCalledWith('focus'))
  })

  it('la pastille de l’engrenage reste allumée tant que l’invitation n’a pas reçu de réponse, même masquée', async () => {
    const user = userEvent.setup()
    renderWithRooms([INVITE])

    await user.click(screen.getByRole('button', { name: 'Masquer la notification' }))
    expect(screen.queryByText(/t’invite à un salon de focus/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Notifications non lues')).toBeInTheDocument()
  })
})

describe('AppShell — demandes venues de la constellation', () => {
  it('« Ouvrir la tâche » ouvre le panneau des tâches', async () => {
    renderAppShell(<div>Contenu</div>)
    expect(screen.queryByRole('dialog', { name: 'Tâches' })).not.toBeInTheDocument()

    act(() => requestOpenTasks())
    expect(await screen.findByRole('dialog', { name: 'Tâches' })).toBeInTheDocument()
  })

  it('« Lancer un focus » choisit la tâche active et passe à l’écran Focus', async () => {
    const onModeChange = vi.fn()
    renderAppShell(<div>Contenu</div>, 'home', onModeChange)

    act(() => requestFocusOnTask('task-42'))
    await waitFor(() => expect(onModeChange).toHaveBeenCalledWith('focus'))
    expect(getActiveTaskId()).toBe('task-42')
    takePendingFocusRequest()
  })
})
