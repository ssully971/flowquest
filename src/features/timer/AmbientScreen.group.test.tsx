import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { ActiveGroupRoomContext, INERT_ACTIVE_ROOM } from '@/features/rooms/active-room-context'
import type { ActiveGroupRoomValue } from '@/features/rooms/active-room-context'
import type { RoomState } from '@/features/rooms/types'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AmbientScreen } from './AmbientScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

function groupValue(isHost: boolean): ActiveGroupRoomValue {
  return {
    ...INERT_ACTIVE_ROOM,
    room: { roomId: 'r1', mode: 'countdown', participants: [] } as unknown as RoomState,
    view: {
      status: 'running',
      phase: 'focus',
      phaseIndex: 0,
      durationMs: 1_500_000,
      elapsedMs: 600_000,
      remainingMs: 900_000,
      isOver: false,
    },
    isHost,
    actions: {
      start: vi.fn().mockResolvedValue(true),
      pause: vi.fn().mockResolvedValue(true),
      resume: vi.fn().mockResolvedValue(true),
      end: vi.fn().mockResolvedValue(true),
      leave: vi.fn().mockResolvedValue(true),
      transfer: vi.fn().mockResolvedValue(true),
      invite: vi.fn().mockResolvedValue(true),
    },
  }
}

function renderAmbient(value: ActiveGroupRoomValue) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <TimerSettingsProvider>
            <ClockSettingsProvider>
              <ActiveGroupRoomContext.Provider value={value}>
                <AmbientScreen />
              </ActiveGroupRoomContext.Provider>
            </ClockSettingsProvider>
          </TimerSettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

afterEach(() => window.localStorage.clear())

describe('AmbientScreen — l’horloge de groupe prend aussi la place de l’horloge solo (LOT M3)', () => {
  it('affiche le temps du salon ; l’hôte peut mettre en pause', async () => {
    const user = userEvent.setup()
    const value = groupValue(true)
    renderAmbient(value)

    expect(await screen.findByTestId('big-digits')).toHaveTextContent('15:00')
    await user.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    expect(value.actions.pause).toHaveBeenCalledTimes(1)
  })

  it('un participant non hôte voit le temps sans bouton de contrôle', async () => {
    renderAmbient(groupValue(false))
    expect(await screen.findByTestId('big-digits')).toHaveTextContent('15:00')
    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lancer' })).not.toBeInTheDocument()
  })
})
