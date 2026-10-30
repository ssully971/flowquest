import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '@/app/AppShell'
import type { AuthStatus } from '@/features/auth/auth-context'
import { AuthGateRequestProvider } from '@/features/auth/AuthGateRequestProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ActiveGroupRoomContext, INERT_ACTIVE_ROOM } from '@/features/rooms/active-room-context'
import { BackgroundDisplaySettingsProvider } from '@/features/settings/BackgroundDisplaySettingsProvider'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AuthStub } from './AuthStub'

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => true }))
vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

const LOCKED = ', verrouillé : crée un compte pour débloquer'

function renderShell(status: AuthStatus) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthStub status={status}>
          <AuthGateRequestProvider>
            <ActiveTaskProvider>
              <TimerSettingsProvider>
                <ClockSettingsProvider>
                  <QuotesSettingsProvider>
                    <ExtrasSettingsProvider>
                      <BackgroundDisplaySettingsProvider>
                        <ActiveGroupRoomContext.Provider value={INERT_ACTIVE_ROOM}>
                          <AppShell mode="focus" onModeChange={vi.fn()}>
                            <div>Contenu</div>
                          </AppShell>
                        </ActiveGroupRoomContext.Provider>
                      </BackgroundDisplaySettingsProvider>
                    </ExtrasSettingsProvider>
                  </QuotesSettingsProvider>
                </ClockSettingsProvider>
              </TimerSettingsProvider>
            </ActiveTaskProvider>
          </AuthGateRequestProvider>
        </AuthStub>
      </ToastProvider>
    </ThemeProvider>,
  )
}

afterEach(() => {
  window.localStorage.clear()
})

describe('AppShell — Tâches et série verrouillées pour un invité', () => {
  it('invité : cadenas visibles, un clic ouvre la modale et jamais le panneau', async () => {
    const user = userEvent.setup()
    renderShell('guest')

    expect(screen.getAllByTestId('locked-badge')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: `Tâches${LOCKED}` }))
    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Tâches' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plus tard' }))

    await user.click(screen.getByRole('button', { name: `Série${LOCKED}` }))
    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()
  })

  it('invité : Entrée au clavier sur le bouton Tâches ouvre aussi la modale', async () => {
    const user = userEvent.setup()
    renderShell('guest')

    screen.getByRole('button', { name: `Tâches${LOCKED}` }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()
  })

  it('connecté : aucun cadenas, le panneau Tâches s’ouvre comme avant', async () => {
    const user = userEvent.setup()
    renderShell('authenticated')

    expect(screen.queryByTestId('locked-badge')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tâches' }))
    expect(await screen.findByRole('dialog', { name: 'Tâches' })).toBeInTheDocument()
  })

  it('chargement de la session : ni cadenas ni modale', () => {
    renderShell('loading')
    expect(screen.queryByTestId('locked-badge')).not.toBeInTheDocument()
  })
})
