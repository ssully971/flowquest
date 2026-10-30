import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ActivePillarProvider } from '@/features/pillars/ActivePillarProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { ThemeProvider } from '@/shared/design-system'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { FocusScreen } from './FocusScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

const toggleMute = vi.fn()
vi.mock('@/features/ambient/useAmbientSounds', () => ({
  useAmbientSounds: () => ({
    activeIds: [],
    volumes: {},
    canActivateMore: true,
    toggle: vi.fn(),
    setVolume: vi.fn(),
    sleepTimerMinutes: null,
    setSleepTimerMinutes: vi.fn(),
    remainingSleepMs: null,
    muted: false,
    toggleMute,
  }),
}))

function renderFocus() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <ActivePillarProvider>
              <TimerSettingsProvider>
                <ClockSettingsProvider>
                  <QuotesSettingsProvider>
                    <ExtrasSettingsProvider>
                      <FocusScreen />
                    </ExtrasSettingsProvider>
                  </QuotesSettingsProvider>
                </ClockSettingsProvider>
              </TimerSettingsProvider>
            </ActivePillarProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

function enableSoundsButton(enabled: boolean) {
  window.localStorage.setItem(
    'flowquest.extrasSettings',
    JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, showFocusSoundsButton: enabled }),
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  toggleMute.mockReset()
  const db = await getDb()
  await db.delete('timerState', 'current')
})

describe('FocusScreen — bouton des sons d’ambiance optionnel (réglage Extras)', () => {
  it('par défaut (réglage désactivé) : aucun bouton de sons sur l’écran Focus', async () => {
    renderFocus()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    expect(screen.queryByRole('button', { name: 'Sons d’ambiance' })).not.toBeInTheDocument()
  })

  it('réglage activé : le bouton apparaît et ouvre le panneau des sons', async () => {
    enableSoundsButton(true)
    const user = userEvent.setup()
    renderFocus()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    await user.click(screen.getByRole('button', { name: 'Sons d’ambiance' }))
    expect(await screen.findByRole('dialog', { name: 'Sons d’ambiance' })).toBeInTheDocument()
  })

  it('la touche M coupe les sons seulement quand le bouton est affiché', async () => {
    enableSoundsButton(true)
    renderFocus()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    fireEvent.keyDown(window, { key: 'm' })
    expect(toggleMute).toHaveBeenCalledTimes(1)
  })

  it('réglage désactivé : la touche M ne fait rien (comportement inchangé)', async () => {
    enableSoundsButton(false)
    renderFocus()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    fireEvent.keyDown(window, { key: 'm' })
    expect(toggleMute).not.toHaveBeenCalled()
  })
})
