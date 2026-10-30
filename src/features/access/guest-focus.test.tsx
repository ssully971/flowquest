import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ActivePillarProvider } from '@/features/pillars/ActivePillarProvider'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { FocusScreen } from '@/features/timer/FocusScreen'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { AuthStub } from './AuthStub'
import type { AuthStatus } from '@/features/auth/auth-context'

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => true }))
vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

function renderFocus(status: AuthStatus) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthStub status={status}>
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
        </AuthStub>
      </ToastProvider>
    </ThemeProvider>,
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  const db = await getDb()
  await db.delete('timerState', 'current')
  window.localStorage.setItem(
    'flowquest.timerSettings',
    JSON.stringify({
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 10,
      sessionsBeforeLongBreak: 4,
      autoStartNext: false,
      deepFocusEnabled: true,
      deepFocusGraceSeconds: 0,
    }),
  )
  // Une tâche active mémorisée d'une ancienne session ne doit pas s'afficher en invité.
  window.localStorage.setItem('flowquest.activeTaskId', 'task-fantome')
})

describe('FocusScreen — invité avec Deep Focus et tâche active mémorisés', () => {
  it('le minuteur fonctionne, Deep Focus est inactif (écran normal conservé), sans tâche active', async () => {
    renderFocus('guest')
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    // Écran normal toujours là (l'écran minimal Deep Focus l'aurait remplacé).
    expect(screen.getByText('Sur quoi veux-tu te concentrer ?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeInTheDocument()
    expect(screen.getByText('Aucune tâche active')).toBeInTheDocument()
    // Le réglage stocké n'a pas été réécrit.
    expect(
      JSON.parse(window.localStorage.getItem('flowquest.timerSettings') ?? '{}'),
    ).toMatchObject({
      deepFocusEnabled: true,
    })
  })

  it('connecté : Deep Focus actif comme avant (écran minimal)', async () => {
    renderFocus('authenticated')
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    expect(screen.queryByText('Sur quoi veux-tu te concentrer ?')).not.toBeInTheDocument()
  })
})
