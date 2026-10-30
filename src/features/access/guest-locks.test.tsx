import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthGateRequestProvider } from '@/features/auth/AuthGateRequestProvider'
import type { AuthStatus } from '@/features/auth/auth-context'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'
import { DEFAULT_QUOTES_SETTINGS } from '@/features/home/quotes-settings'
import { DEFAULT_BACKGROUND_DISPLAY_SETTINGS } from '@/features/settings/background-display-settings'
import { CustomBackgroundProvider } from '@/features/settings/CustomBackgroundProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { TimerPage } from '@/features/settings/pages/TimerPage'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { useActiveTask } from '@/features/tasks/active-task-context'
import { AmbientScreen } from '@/features/timer/AmbientScreen'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AuthStub } from './AuthStub'

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => true }))
vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

const LOCKED = ', verrouillé : crée un compte pour débloquer'

function Shell({ status, children }: { status: AuthStatus; children: ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthStub status={status}>
          <AuthGateRequestProvider>
            <ExtrasSettingsProvider>{children}</ExtrasSettingsProvider>
          </AuthGateRequestProvider>
        </AuthStub>
      </ThemeProvider>
    </ToastProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.setItem('flowquest.authGateDismissed', 'true')
})

afterEach(() => {
  window.localStorage.clear()
})

describe('TimerPage — Deep Focus verrouillé pour un invité', () => {
  const stored = { ...DEFAULT_TIMER_SETTINGS, deepFocusEnabled: true }

  it('invité : cadenas, interrupteur éteint, clic → modale, réglage stocké jamais modifié', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Shell status="guest">
        <TimerPage settings={stored} onChange={onChange} />
      </Shell>,
    )

    const toggle = screen.getByRole('switch', { name: `Deep Focus${LOCKED}` })
    expect(toggle).not.toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByLabelText('Délai de grâce avant la pause')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('connecté : fonctionne comme avant', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Shell status="authenticated">
        <TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />
      </Shell>,
    )

    await user.click(screen.getByRole('switch', { name: 'Deep Focus' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, deepFocusEnabled: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('locked-badge')).not.toBeInTheDocument()
  })
})

describe('AmbientScreen — mixeur de sons verrouillé pour un invité', () => {
  function renderAmbient(status: AuthStatus) {
    return render(
      <Shell status={status}>
        <TimerSettingsProvider>
          <ClockSettingsProvider>
            <AmbientScreen />
          </ClockSettingsProvider>
        </TimerSettingsProvider>
      </Shell>,
    )
  }

  it('invité : le minuteur reste libre, le bouton sons ouvre la modale, jamais le mixeur', async () => {
    const user = userEvent.setup()
    renderAmbient('guest')

    await screen.findByTestId('big-digits')
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `Sons d’ambiance${LOCKED}` }))
    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Sons d’ambiance' })).not.toBeInTheDocument()
  })

  it('invité : Échap ferme la modale et rend le focus au bouton', async () => {
    const user = userEvent.setup()
    renderAmbient('guest')
    await screen.findByTestId('big-digits')

    const button = screen.getByRole('button', { name: `Sons d’ambiance${LOCKED}` })
    await user.click(button)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('connecté : le mixeur s’ouvre comme avant, sans cadenas', async () => {
    const user = userEvent.setup()
    renderAmbient('authenticated')
    await screen.findByTestId('big-digits')

    await user.click(screen.getByRole('button', { name: 'Sons d’ambiance' }))
    expect(await screen.findByRole('dialog', { name: 'Sons d’ambiance' })).toBeInTheDocument()
    expect(screen.queryByTestId('locked-badge')).not.toBeInTheDocument()
  })
})

describe('SettingsPanel — Statistiques verrouillées pour un invité', () => {
  function renderPanel(
    status: AuthStatus,
    defaultSettingsTab = DEFAULT_EXTRAS_SETTINGS.defaultSettingsTab,
  ) {
    return render(
      <Shell status={status}>
        <CustomBackgroundProvider>
          <SettingsPanel
            open
            onClose={vi.fn()}
            onOpenSocial={vi.fn()}
            mode="home"
            onModeChange={vi.fn()}
            backgroundSelections={{
              home: { dark: 'horizon', light: 'horizon', linked: true },
              focus: { dark: 'horizon', light: 'horizon', linked: true },
              ambient: { dark: 'horizon', light: 'horizon', linked: true },
            }}
            onBackgroundSelect={vi.fn()}
            onBackgroundLinkedChange={vi.fn()}
            backgroundDisplaySettings={DEFAULT_BACKGROUND_DISPLAY_SETTINGS}
            onBackgroundDisplaySettingsChange={vi.fn()}
            dailyGoalMinutes={120}
            onDailyGoalChange={vi.fn()}
            timerSettings={DEFAULT_TIMER_SETTINGS}
            onTimerSettingsChange={vi.fn()}
            clockSettings={DEFAULT_CLOCK_SETTINGS}
            onClockSettingsChange={vi.fn()}
            quotesSettings={DEFAULT_QUOTES_SETTINGS}
            onQuotesSettingsChange={vi.fn()}
            extrasSettings={{ ...DEFAULT_EXTRAS_SETTINGS, defaultSettingsTab }}
            onExtrasSettingsChange={vi.fn()}
          />
        </CustomBackgroundProvider>
      </Shell>,
    )
  }

  it('invité : l’entrée reste visible avec cadenas et ouvre la modale au lieu de la page', async () => {
    const user = userEvent.setup()
    renderPanel('guest')

    const entry = await screen.findByRole('button', { name: `Stats${LOCKED}` })
    await user.click(entry)

    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Statistiques' })).not.toBeInTheDocument()
  })

  it('invité : la page Stats n’est jamais affichée même si c’est l’onglet par défaut', async () => {
    renderPanel('guest', 'stats')

    await screen.findByRole('button', { name: `Stats${LOCKED}` })
    expect(screen.queryByRole('heading', { name: 'Statistiques' })).not.toBeInTheDocument()
  })

  it('connecté : la page Stats s’ouvre normalement, sans cadenas', async () => {
    const user = userEvent.setup()
    renderPanel('authenticated')

    await user.click(await screen.findByRole('button', { name: 'Stats' }))
    expect(screen.queryByRole('dialog', { name: /Débloque/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('locked-badge')).not.toBeInTheDocument()
  })
})

describe('ActiveTaskProvider — tâche active ignorée pour un invité, sans toucher aux données', () => {
  function Probe() {
    const { activeTaskId } = useActiveTask()
    return <p data-testid="active">{activeTaskId ?? 'aucune'}</p>
  }

  it.each([
    ['guest', 'aucune'],
    ['authenticated', 'task-1'],
  ] as const)('%s → tâche active « %s »', (status, expected) => {
    window.localStorage.setItem('flowquest.activeTaskId', 'task-1')
    render(
      <AuthStub status={status}>
        <ActiveTaskProvider>
          <Probe />
        </ActiveTaskProvider>
      </AuthStub>,
    )

    expect(screen.getByTestId('active')).toHaveTextContent(expected)
    expect(window.localStorage.getItem('flowquest.activeTaskId')).toBe('task-1')
  })
})
