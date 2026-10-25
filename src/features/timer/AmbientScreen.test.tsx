import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { AmbientScreen } from './AmbientScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

async function clearTimerState() {
  const db = await getDb()
  await db.delete('timerState', 'current')
}

vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

function renderAmbientScreen() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <TimerSettingsProvider>
          <ClockSettingsProvider>
            <AmbientScreen />
          </ClockSettingsProvider>
        </TimerSettingsProvider>
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('AmbientScreen — minuteur compact en carte Liquid Glass, reste de l’écran libre (§5.3, LOT C2)', () => {
  it('affiche le temps restant et un bouton de lecture, sans le reste de l’UI du mode Focus', async () => {
    renderAmbientScreen()

    expect(await screen.findByTestId('big-digits')).toHaveTextContent('25:00')
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
    expect(screen.queryByText('Sur quoi te concentres-tu ?')).not.toBeInTheDocument()
  })

  it('démarre et met en pause le minuteur depuis la carte compacte', async () => {
    const user = userEvent.setup()
    renderAmbientScreen()

    await screen.findByTestId('big-digits')
    await user.click(screen.getByRole('button', { name: 'Démarrer' }))

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
  })

  it('ouvre le panneau des sons d’ambiance (§12/§17/§18)', async () => {
    const user = userEvent.setup()
    renderAmbientScreen()

    await screen.findByTestId('big-digits')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sons d’ambiance' }))
    expect(await screen.findByRole('dialog', { name: 'Sons d’ambiance' })).toBeInTheDocument()
  })

  it('l’horloge suit la taille et la couleur réglées dans Réglages > Horloge', async () => {
    window.localStorage.setItem(
      'flowquest.clockSettings',
      JSON.stringify({
        format: '24h',
        size: 'huge',
        showSeconds: false,
        showGreeting: true,
        flipClock: false,
        style: 'default-bold',
        color: '#F2555A',
      }),
    )
    renderAmbientScreen()

    const digits = await screen.findByTestId('big-digits')
    expect(digits.style.color).toBe('rgb(242, 85, 90)')
  })

  it('l’horloge suit aussi le style de police réglé dans Réglages > Horloge (LOT E2)', async () => {
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
    renderAmbientScreen()

    const digits = await screen.findByTestId('big-digits')
    expect(digits.style.fontFamily).toContain('Georgia')
  })
})

describe('AmbientScreen — raccourcis clavier (LOT G1)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearTimerState()
  })

  it('Espace démarre le minuteur', async () => {
    renderAmbientScreen()
    await screen.findByTestId('big-digits')

    fireEvent.keyDown(window, { key: ' ' })

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
  })

  it('M coupe/rétablit les sons d’ambiance', async () => {
    renderAmbientScreen()
    await screen.findByTestId('big-digits')

    // Pas d'assertion directe sur l'état audio (useAmbientSounds n'est pas mocké ici) :
    // vérifie seulement que la touche ne lève aucune erreur et n'affecte pas le reste de
    // l'écran — le comportement du gain maître est déjà couvert par
    // useAmbientSounds.test.ts.
    expect(() => fireEvent.keyDown(window, { key: 'm' })).not.toThrow()
    expect(screen.getByTestId('big-digits')).toBeInTheDocument()
  })

  it('? ouvre la fenêtre d’aide des raccourcis', async () => {
    renderAmbientScreen()
    await screen.findByTestId('big-digits')

    fireEvent.keyDown(window, { key: '?' })

    expect(await screen.findByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument()
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

describe('AmbientScreen — Deep Focus (LOT G2)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearTimerState()
  })

  afterEach(() => {
    setVisibility('visible')
  })

  it('aucun indicateur tant que Deep Focus est désactivé (réglage par défaut)', async () => {
    renderAmbientScreen()
    await screen.findByTestId('big-digits')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    expect(screen.queryByText('Deep Focus actif')).not.toBeInTheDocument()
  })

  it('affiche l’indicateur et propose « Reprendre » quand l’onglet passe en arrière-plan', async () => {
    seedDeepFocusSettings()
    renderAmbientScreen()
    await screen.findByTestId('big-digits')

    fireEvent.keyDown(window, { key: ' ' })
    await screen.findByRole('button', { name: 'Mettre en pause' })

    expect(await screen.findByText('Deep Focus actif')).toBeInTheDocument()

    setVisibility('hidden')
    setVisibility('visible')

    const toastMessage = await screen.findByText(
      'Ton minuteur a été mis en pause. Reprends quand tu veux.',
    )
    const toastContainer = toastMessage.closest('[role="status"]') as HTMLElement
    expect(within(toastContainer).getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
  })
})
