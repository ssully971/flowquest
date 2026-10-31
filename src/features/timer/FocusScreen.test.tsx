import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ActivePillarProvider } from '@/features/pillars/ActivePillarProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { requestFocusOnTask, takePendingFocusRequest } from '@/features/tasks/panel-requests'
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

  it('mise en page normale inchangée tant que Deep Focus est désactivé (réglage par défaut)', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    expect(screen.getByText('Sur quoi veux-tu te concentrer ?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeInTheDocument()
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

describe('FocusScreen — mise en page Deep Focus (lot 3 bis, §6)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearTimerState()
  })

  it('mise en page normale tant que rien n’a démarré, même avec Deep Focus actif', async () => {
    seedDeepFocusSettings()
    renderFocusScreen()

    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()
  })

  it('bascule vers l’écran minimal (rien que le temps et deux boutons) une fois la session démarrée', async () => {
    seedDeepFocusSettings()
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    // Écran normal entièrement remplacé : plus de question, plus de Réinitialiser/Passer/PIP
    // (exclusifs à TimerControls, jamais rendus par DeepFocusSession).
    expect(screen.queryByText('Sur quoi veux-tu te concentrer ?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Passer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeInTheDocument()
  })

  it('reste sur l’écran minimal pendant une pause manuelle (pas de clignotement de mise en page)', async () => {
    seedDeepFocusSettings()
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }))

    expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
    expect(screen.queryByText('Sur quoi veux-tu te concentrer ?')).not.toBeInTheDocument()
  })

  it('revient à la mise en page normale en terminant la session depuis l’écran minimal', async () => {
    // Moins d'une minute de focus : « Terminer » demande d'abord confirmation (erreur de clic).
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    seedDeepFocusSettings()
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(await screen.findByText('Session terminée')).toBeInTheDocument()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })
})

describe('FocusScreen — piliers de vie désactivés (lot 4, §5)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('masque le sélecteur de pilier quand le réglage est désactivé', async () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, pillarsEnabled: false }),
    )
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    expect(screen.queryByRole('button', { name: /Pilier de la session/ })).not.toBeInTheDocument()
  })

  it('affiche le sélecteur de pilier quand le réglage est activé (comportement par défaut)', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')

    expect(await screen.findByRole('button', { name: /Pilier de la session/ })).toBeInTheDocument()
  })
})

describe('FocusScreen — « Lancer un focus » depuis la constellation', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    takePendingFocusRequest()
    await clearTimerState()
    const db = await getDb()
    // Pilier réel : le sélecteur remplace sinon un pilier inconnu par le premier pilier actif.
    await db.put('pillars', {
      id: 'pillar-c',
      name: 'Études',
      color: '#4A9FE8',
      currentXp: 0,
      level: 1,
      createdAt: 1,
      archivedAt: null,
      goalLevel: null,
      goalDeadline: null,
    })
    await db.put('tasks', {
      id: 'task-c',
      title: 'Lecture ECG',
      emoji: null,
      color: null,
      etaMinutes: null,
      parentId: null,
      position: 0,
      done: false,
      doneAt: null,
      createdAt: 1,
      updatedAt: 1,
      pillarId: 'pillar-c',
    })
  })

  afterEach(async () => {
    takePendingFocusRequest()
    await clearTimerState()
    const db = await getDb()
    await db.delete('tasks', 'task-c')
    await db.delete('pillars', 'pillar-c')
  })

  it('démarre le minuteur au repos et prend le pilier de la tâche', async () => {
    requestFocusOnTask('task-c')
    renderFocusScreen()

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
    expect(window.localStorage.getItem('flowquest.activePillarId')).toBe('pillar-c')
    expect(takePendingFocusRequest()).toBeNull() // consommée
  })

  it('sans demande, le minuteur reste au repos', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi veux-tu te concentrer ?')
    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).not.toBeInTheDocument()
  })
})
