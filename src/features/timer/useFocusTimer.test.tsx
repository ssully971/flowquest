import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { TimerSettingsProvider } from './TimerSettingsProvider'
import { useFocusTimer } from './useFocusTimer'

vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

const STORAGE_KEY = 'flowquest.timerSettings'

// Durées exprimées en fraction de minute pour que les segments se terminent en quelques
// dizaines de millisecondes réelles : évite tout mélange fragile entre minuteurs fictifs
// (vi.useFakeTimers) et l'attente asynchrone réelle d'IndexedDB (fake-indexeddb) utilisée
// par la persistance du minuteur. La validation des plages (10-100 min etc.) n'intervient
// que côté UI (TimerPage) ; ici on peuple directement le stockage local, comme le ferait un
// réglage distant restauré depuis un autre appareil avec une valeur déjà hors plage.
function seedTimerSettings(overrides: {
  focusMinutes?: number
  shortBreakMinutes?: number
  longBreakMinutes?: number
  sessionsBeforeLongBreak?: number
  autoStartNext?: boolean
  sessionGoalType?: 'none' | 'count' | 'duration'
  sessionGoalCount?: number
  sessionGoalMinutes?: number
}) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      focusMinutes: 0.001,
      shortBreakMinutes: 0.001,
      longBreakMinutes: 0.001,
      sessionsBeforeLongBreak: 2,
      autoStartNext: false,
      sessionGoalType: 'none',
      sessionGoalCount: 4,
      sessionGoalMinutes: 120,
      ...overrides,
    }),
  )
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <TimerSettingsProvider>{children}</TimerSettingsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

async function clearTimerState() {
  const db = await getDb()
  await db.delete('timerState', 'current')
}

beforeEach(async () => {
  window.localStorage.clear()
  await clearTimerState()
})

describe('useFocusTimer — durées configurables et démarrage automatique', () => {
  it('utilise la durée de focus configurée dans Réglages > Minuteur', async () => {
    seedTimerSettings({ focusMinutes: 15 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.snapshot?.remainingMs).toBe(15 * 60_000)
  })

  it('ne démarre pas le segment suivant automatiquement quand l’option est désactivée', async () => {
    seedTimerSettings({ autoStartNext: false })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())

    await waitFor(() => expect(result.current.segment).toBe('short_break'), { timeout: 3000 })
    expect(result.current.snapshot?.status).toBe('idle')
  })

  it('démarre automatiquement le segment suivant quand l’option est activée', async () => {
    // Pause courte volontairement plus longue que la fenêtre d'attente du test : sans
    // cela, avec deux segments aussi courts (60 ms), le second a parfois déjà terminé
    // lui-même avant que le test observe l'état "running" qui suit son démarrage auto.
    seedTimerSettings({ shortBreakMinutes: 1, autoStartNext: true })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())

    await waitFor(() => expect(result.current.segment).toBe('short_break'), { timeout: 3000 })
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'), { timeout: 3000 })
  })

  it('respecte le nombre de sessions avant pause longue configuré', async () => {
    seedTimerSettings({ sessionsBeforeLongBreak: 2, autoStartNext: true })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    // 1er focus -> pause courte (démarrée automatiquement)
    await waitFor(() => expect(result.current.segment).toBe('short_break'), { timeout: 3000 })
    // pause courte -> focus (démarré automatiquement)
    await waitFor(() => expect(result.current.segment).toBe('focus'), { timeout: 3000 })
    // 2e focus -> pause longue (sessionsBeforeLongBreak atteint)
    await waitFor(() => expect(result.current.segment).toBe('long_break'), { timeout: 3000 })
  })
})

describe('useFocusTimer — trois modes de minuteur (lot 4)', () => {
  it('démarre en mode pomodoro, segment focus, par défaut', async () => {
    const { result } = renderHook(() => useFocusTimer(), { wrapper })

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.mode).toBe('pomodoro')
    expect(result.current.segment).toBe('focus')
  })

  it('selectMode bascule vers le compte à rebours (segment et durée dédiés)', async () => {
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.selectMode('countdown')
    })

    await waitFor(() => expect(result.current.mode).toBe('countdown'))
    expect(result.current.segment).toBe('countdown')
    expect(result.current.snapshot?.remainingMs).toBe(20 * 60_000) // 20 min par défaut
  })

  it('selectMode bascule vers le chronomètre (durée illimitée)', async () => {
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.selectMode('stopwatch')
    })

    await waitFor(() => expect(result.current.mode).toBe('stopwatch'))
    expect(result.current.segment).toBe('stopwatch')
    expect(result.current.snapshot?.remainingMs).toBeNull()
  })

  it('revenir en mode pomodoro repart du segment focus', async () => {
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.selectMode('stopwatch')
    })
    await waitFor(() => expect(result.current.mode).toBe('stopwatch'))

    act(() => {
      result.current.selectMode('pomodoro')
    })

    await waitFor(() => expect(result.current.mode).toBe('pomodoro'))
    expect(result.current.segment).toBe('focus')
  })
})

describe('useFocusTimer — objectif de session (lot 4)', () => {
  it('signale l’objectif atteint après le nombre de sessions visé, sans enchaîner la suite', async () => {
    seedTimerSettings({
      autoStartNext: true,
      sessionGoalType: 'count',
      sessionGoalCount: 2,
    })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())

    await waitFor(() => expect(result.current.goalReached).toBe(true), { timeout: 5000 })
    expect(result.current.goalProgress).toBe(2)
    // L'objectif atteint interrompt l'enchaînement automatique : le segment reste sur la
    // 2e session de focus (terminée), au lieu d'avoir basculé sur la pause suivante.
    expect(result.current.segment).toBe('focus')
  })

  it('continueAfterGoal reprend l’enchaînement normal du cycle', async () => {
    seedTimerSettings({
      shortBreakMinutes: 1,
      autoStartNext: false,
      sessionGoalType: 'count',
      sessionGoalCount: 1,
    })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.goalReached).toBe(true), { timeout: 3000 })

    act(() => result.current.continueAfterGoal())

    await waitFor(() => expect(result.current.segment).toBe('short_break'))
    expect(result.current.goalReached).toBe(false)
  })

  it('changer de mode réinitialise la progression de l’objectif', async () => {
    seedTimerSettings({
      autoStartNext: false,
      sessionGoalType: 'count',
      sessionGoalCount: 1,
    })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.goalReached).toBe(true), { timeout: 3000 })

    act(() => result.current.selectMode('pomodoro'))

    await waitFor(() => expect(result.current.goalReached).toBe(false))
    expect(result.current.goalProgress).toBe(0)
  })
})
