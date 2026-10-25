import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ActivePillarProvider } from '@/features/pillars/ActivePillarProvider'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { ThemeProvider } from '@/shared/design-system'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { FocusScreen } from './FocusScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

async function clearTimerState() {
  const db = await getDb()
  await db.delete('timerState', 'current')
}

function renderFocusScreen() {
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

describe('FocusScreen — ne chevauche jamais la barre du bas commune et ne masque jamais la question', () => {
  it('réserve un espace bas (padding) pour ne pas chevaucher la barre commune', async () => {
    renderFocusScreen()
    const question = await screen.findByText('Sur quoi veux-tu te concentrer ?')
    const root = question.closest('div[class*="flex"][class*="flex-col"]')
    expect(root?.className).toContain('pb-24')
    expect(root?.className).toContain('sm:pb-28')
  })

  it('le contenu est dans un conteneur défilant (overflow-y-auto), jamais tronqué sans recours', async () => {
    renderFocusScreen()
    const question = await screen.findByText('Sur quoi veux-tu te concentrer ?')
    const scrollContainer = question.closest('div[class*="flex"][class*="flex-col"]')?.parentElement
    expect(scrollContainer?.className).toContain('overflow-y-auto')
  })

  it('utilise min-h-full (centrage sûr) plutôt que h-full+justify-center (qui tronquerait le haut)', async () => {
    renderFocusScreen()
    const question = await screen.findByText('Sur quoi veux-tu te concentrer ?')
    const root = question.closest('div[class*="flex"][class*="flex-col"]')
    expect(root?.className).toContain('min-h-full')
  })
})

describe('FocusScreen — citation optionnelle (masquée par défaut)', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('ne montre aucune citation tant que « Afficher en mode Focus » n’est pas activé', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    expect(document.querySelector('blockquote')).toBeNull()
  })

  it('montre une citation quand « Afficher en mode Focus » est activé', async () => {
    window.localStorage.setItem(
      'flowquest.quotesSettings',
      JSON.stringify({
        showOnHome: true,
        showOnFocus: true,
        rotation: 'daily',
        category: 'all',
      }),
    )
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    expect(document.querySelector('blockquote')).not.toBeNull()
  })
})

describe('FocusScreen — la police de l’horloge suit Réglages > Horloge (LOT E2)', () => {
  it('applique le style de police choisi à l’horloge du Focus, pas seulement à celle de l’accueil', async () => {
    window.localStorage.setItem(
      'flowquest.clockSettings',
      JSON.stringify({
        format: '24h',
        size: 'normal',
        showSeconds: false,
        showGreeting: true,
        flipClock: false,
        style: 'serif',
        color: 'auto',
      }),
    )
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    const digits = await screen.findByTestId('big-digits')
    expect(digits.style.fontFamily).toContain('Georgia')
  })
})

describe('FocusScreen — raccourcis clavier (LOT G1)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearTimerState()
  })

  it('Espace démarre le minuteur', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
  })

  it('? ouvre la fenêtre d’aide des raccourcis', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: '?' })

    expect(await screen.findByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument()
  })

  it('n’agit pas quand le réglage « Raccourcis clavier » est désactivé', async () => {
    window.localStorage.setItem(
      'flowquest.timerSettings',
      JSON.stringify({
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 10,
        sessionsBeforeLongBreak: 4,
        autoStartNext: false,
        keyboardShortcutsEnabled: false,
      }),
    )
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })

    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).not.toBeInTheDocument()
  })
})

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  fireEvent(document, new Event('visibilitychange'))
}

function seedDeepFocusSettings() {
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
}

describe('FocusScreen — Deep Focus (LOT G2)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearTimerState()
  })

  afterEach(() => {
    setVisibility('visible')
  })

  it('aucun indicateur tant que Deep Focus est désactivé (réglage par défaut)', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    expect(screen.queryByText('Deep Focus actif')).not.toBeInTheDocument()
  })

  it('affiche l’indicateur pendant une session de focus quand Deep Focus est actif', async () => {
    seedDeepFocusSettings()
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    expect(await screen.findByText('Deep Focus actif')).toBeInTheDocument()
  })

  it('met le minuteur en pause et propose « Reprendre » quand l’onglet passe en arrière-plan', async () => {
    seedDeepFocusSettings()
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    setVisibility('hidden')
    setVisibility('visible')

    const toastMessage = await screen.findByText(
      'Ton minuteur a été mis en pause. Reprends quand tu veux.',
    )
    const toastContainer = toastMessage.closest('[role="status"]') as HTMLElement
    expect(within(toastContainer).getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
  })
})
