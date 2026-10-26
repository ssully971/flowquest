import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { setActivePillarIdRef } from '@/features/pillars/active-pillar-ref'
import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord, PillarRecord } from '@/shared/storage/db'
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
  cycleEndMode?: 'longBreakAfterN' | 'stopAfterN'
  cycleEndUnlimited?: boolean
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
      cycleEndMode: 'longBreakAfterN',
      cycleEndUnlimited: false,
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

function focusSession(overrides: Partial<FocusSessionRecord> & { startedAt: number }): FocusSessionRecord {
  return {
    id: crypto.randomUUID(),
    kind: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 1500,
    endedAt: overrides.startedAt + 1500_000,
    completed: true,
    taskId: null,
    pillarId: null,
    syncedAt: null,
    ...overrides,
  }
}

async function seedPillar(overrides: Partial<PillarRecord> = {}): Promise<void> {
  const pillar: PillarRecord = {
    id: 'pillar-1',
    name: 'Travail',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: Date.now(),
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
    ...overrides,
  }
  const db = await getDb()
  await db.put('pillars', pillar)
}

beforeEach(async () => {
  window.localStorage.clear()
  await clearTimerState()
  const db = await getDb()
  const keys = await db.getAllKeys('focusSessions')
  await Promise.all(keys.map((key) => db.delete('focusSessions', key)))
  const pillarKeys = await db.getAllKeys('pillars')
  await Promise.all(pillarKeys.map((key) => db.delete('pillars', key)))
  setActivePillarIdRef(null)
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

describe('useFocusTimer — numéro de session cohérent entre appareils (LOT E3)', () => {
  it('un nouvel appareil (2e contexte simulé) reprend le bon numéro depuis l’historique, pas « session 1 »', async () => {
    const now = Date.now()
    const db = await getDb()
    // Simule 2 sessions de focus déjà faites aujourd'hui sur l'ordinateur, synchronisées
    // côté compte avant que la tablette (ce rendu-ci) ne se connecte.
    await db.put('focusSessions', focusSession({ startedAt: now - 2000 }))
    await db.put('focusSessions', focusSession({ startedAt: now - 1000 }))

    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    // La tablette affiche bien la 3e session (completedFocusCount reconstruit à 2), jamais
    // « session 1 » comme avant le correctif (compteur local reparti de 0).
    expect(result.current.cycle.completedFocusCount).toBe(2)
  })

  it('deux contextes simulant deux appareils affichent le même numéro de session à partir du même historique', async () => {
    const now = Date.now()
    const db = await getDb()
    // 3 sessions de focus déjà enregistrées aujourd'hui pour ce compte (ex. faites sur
    // l'ordinateur), synchronisées côté serveur comme le fait useSessionSync.
    await db.put('focusSessions', focusSession({ startedAt: now - 3000 }))
    await db.put('focusSessions', focusSession({ startedAt: now - 2000 }))
    await db.put('focusSessions', focusSession({ startedAt: now - 1000 }))

    // Contexte A (ordinateur, après rafraîchissement) et contexte B (tablette, à la
    // connexion) : deux instances indépendantes du minuteur lisant le même historique.
    const contextA = renderHook(() => useFocusTimer(), { wrapper })
    const contextB = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(contextA.result.current.isReady).toBe(true))
    await waitFor(() => expect(contextB.result.current.isReady).toBe(true))

    // Les deux doivent afficher la 4e session (completedFocusCount === 3), jamais
    // « session 1 » sur l'un des deux appareils comme dans le bug signalé.
    expect(contextA.result.current.cycle.completedFocusCount).toBe(3)
    expect(contextB.result.current.cycle.completedFocusCount).toBe(3)
  })
})

describe('useFocusTimer — jamais de fin de session implicite en changeant d’onglet (LOT E5)', () => {
  it('bloque le changement d’onglet tant qu’une session tourne ou est en pause', async () => {
    seedTimerSettings({ focusMinutes: 1 }) // assez long pour ne pas se terminer pendant le test
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.isSegmentSwitchBlocked).toBe(false)

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    expect(result.current.isSegmentSwitchBlocked).toBe(true)

    act(() => result.current.selectSegment('short_break'))
    // Le changement est bloqué : toujours en focus, aucune nouvelle session enregistrée.
    expect(result.current.segment).toBe('focus')
    expect(result.current.snapshot?.status).toBe('running')

    act(() => result.current.pause())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('paused'))
    expect(result.current.isSegmentSwitchBlocked).toBe(true)

    act(() => result.current.selectSegment('long_break'))
    expect(result.current.segment).toBe('focus')
  })

  it('autorise de nouveau le changement d’onglet une fois la session réinitialisée', async () => {
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    act(() => result.current.reset())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('idle'))

    expect(result.current.isSegmentSwitchBlocked).toBe(false)
    act(() => result.current.selectSegment('short_break'))
    await waitFor(() => expect(result.current.segment).toBe('short_break'))
  })
})

describe('useFocusTimer — réglage « Fin de cycle » (LOT E5)', () => {
  it('mode « S’arrêter après N sessions » : la session se termine au lieu d’enchaîner une pause longue', async () => {
    seedTimerSettings({
      sessionsBeforeLongBreak: 2,
      autoStartNext: true,
      cycleEndMode: 'stopAfterN',
    })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.segment).toBe('short_break'), { timeout: 3000 })
    await waitFor(() => expect(result.current.segment).toBe('focus'), { timeout: 3000 })
    await waitFor(() => expect(result.current.cycleEnded).toBe(true), { timeout: 3000 })

    expect(result.current.sessionSummary?.sessionsCount).toBe(2)
    // Jamais de pause longue imposée dans ce mode : le segment reste sur le dernier focus.
    expect(result.current.segment).toBe('focus')
  })

  it('mode « Pause longue après N sessions » illimité : pas de pause longue automatique', async () => {
    seedTimerSettings({
      sessionsBeforeLongBreak: 2,
      autoStartNext: true,
      cycleEndMode: 'longBreakAfterN',
      cycleEndUnlimited: true,
    })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.segment).toBe('short_break'), { timeout: 3000 })
    await waitFor(() => expect(result.current.segment).toBe('focus'), { timeout: 3000 })
    await waitFor(() => expect(result.current.cycle.completedFocusCount).toBeGreaterThanOrEqual(2), {
      timeout: 3000,
    })

    expect(result.current.segment).not.toBe('long_break')
    expect(result.current.cycleEnded).toBe(false)
  })
})

describe('useFocusTimer — fin de session via le bouton Terminer (LOT E6)', () => {
  it('enregistre la session en cours (temps réel) et affiche le bilan', async () => {
    seedTimerSettings({ focusMinutes: 1 }) // assez long pour ne pas se terminer pendant le test
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    // Laisse s'écouler un peu de temps réel avant d'arrêter : actualSeconds est arrondi à
    // la seconde (voir recordSession), sans quoi un arrêt quasi instantané arrondirait à 0.
    await new Promise((resolve) => setTimeout(resolve, 1100))

    act(() => result.current.endSession())
    await waitFor(() => expect(result.current.cycleEnded).toBe(true))

    expect(result.current.sessionSummary).not.toBeNull()
    expect(result.current.sessionSummary?.sessionsCount).toBe(1)
    expect(result.current.sessionSummary?.focusSeconds).toBeGreaterThan(0)
  })

  it('acknowledgeSessionEnd repart sur un cycle neuf', async () => {
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    act(() => result.current.endSession())
    await waitFor(() => expect(result.current.cycleEnded).toBe(true))

    act(() => result.current.acknowledgeSessionEnd())

    await waitFor(() => expect(result.current.cycleEnded).toBe(false))
    expect(result.current.sessionSummary).toBeNull()
    expect(result.current.cycle.completedFocusCount).toBe(0)
    expect(result.current.segment).toBe('focus')
    expect(result.current.snapshot?.status).toBe('idle')
  })
})

describe('useFocusTimer — startedAt exposé pour la citation par phase (LOT G1)', () => {
  it('null tant que la phase n’a pas démarré, fixé une fois start() appelé', async () => {
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    expect(result.current.startedAt).toBeNull()

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    expect(result.current.startedAt).not.toBeNull()
  })

  it('reste identique à travers une pause puis une reprise', async () => {
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    const startedAt = result.current.startedAt

    act(() => result.current.pause())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('paused'))
    expect(result.current.startedAt).toBe(startedAt)

    act(() => result.current.resume())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    expect(result.current.startedAt).toBe(startedAt)
  })

  it('redevient null après un reset', async () => {
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.startedAt).not.toBeNull())

    act(() => result.current.reset())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('idle'))
    expect(result.current.startedAt).toBeNull()
  })
})

describe('useFocusTimer — pause() accepte un horodatage explicite (LOT G2, Deep Focus)', () => {
  it('gèle le temps écoulé à l’horodatage donné, pas à l’instant réel de l’appel', async () => {
    // Durée longue (1h) pour que l'écart entre l'horodatage demandé et l'exécution réelle
    // reste négligeable devant la durée totale, et que rien ne se termine pendant le test.
    seedTimerSettings({ focusMinutes: 60 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))

    // Scénario « quitter 40 s puis revenir » : l'onglet se cache à t0, Deep Focus déclenche
    // pause(t0) — mais l'exécution réelle (ce code) ne tourne qu'au retour, bien après t0.
    const hiddenAt = Date.now() - 40_000
    act(() => result.current.pause(hiddenAt))
    await waitFor(() => expect(result.current.snapshot?.status).toBe('paused'))

    // Le temps de focus compté s'arrête à hiddenAt, jamais aux 40 s qui se sont écoulées
    // en vrai avant que ce test n'exécute l'assertion.
    expect(result.current.snapshot?.elapsedMs).toBeLessThan(1000)
  })

  it('sans horodatage, se comporte comme avant (Date.now() implicite)', async () => {
    seedTimerSettings({ focusMinutes: 60 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))

    act(() => result.current.pause())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('paused'))
    expect(result.current.snapshot?.elapsedMs).toBeLessThan(1000)
  })
})

describe('useFocusTimer — pillarLevelUp (LOT G3)', () => {
  it('se remplit quand le pilier actif passe un niveau pendant le cycle', async () => {
    // 1 min de focus réel = 10 XP (pillar-xp.ts), donc 1 XP exige au moins 6 s réelles
    // (floor(6 * 10 / 60) = 1) : on attend 6,5 s pour rester correct même si l'arrondi à
    // la seconde (voir recordSession) tombe à 6 ou 7. Seuil du niveau 2 : 600 XP — à 599,
    // ce seul XP gagné suffit à passer niveau 2.
    await seedPillar({ currentXp: 599, level: 1 })
    setActivePillarIdRef('pillar-1')
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    expect(result.current.pillarLevelUp).toBeNull()

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    await new Promise((resolve) => setTimeout(resolve, 6500))

    act(() => result.current.endSession())
    await waitFor(() => expect(result.current.cycleEnded).toBe(true))
    await waitFor(() => expect(result.current.pillarLevelUp).not.toBeNull())

    expect(result.current.pillarLevelUp?.pillarId).toBe('pillar-1')
    expect(result.current.pillarLevelUp?.newLevel).toBe(2)
  }, 10_000)

  it('reste null sans changement de niveau', async () => {
    await seedPillar({ currentXp: 0, level: 1 })
    setActivePillarIdRef('pillar-1')
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    await new Promise((resolve) => setTimeout(resolve, 1100))

    act(() => result.current.endSession())
    await waitFor(() => expect(result.current.cycleEnded).toBe(true))

    expect(result.current.pillarLevelUp).toBeNull()
  })

  it('est remis à zéro par acknowledgeSessionEnd', async () => {
    await seedPillar({ currentXp: 599, level: 1 })
    setActivePillarIdRef('pillar-1')
    seedTimerSettings({ focusMinutes: 1 })
    const { result } = renderHook(() => useFocusTimer(), { wrapper })
    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.snapshot?.status).toBe('running'))
    await new Promise((resolve) => setTimeout(resolve, 6500))

    act(() => result.current.endSession())
    await waitFor(() => expect(result.current.cycleEnded).toBe(true))
    await waitFor(() => expect(result.current.pillarLevelUp).not.toBeNull())

    act(() => result.current.acknowledgeSessionEnd())
    await waitFor(() => expect(result.current.cycleEnded).toBe(false))
    expect(result.current.pillarLevelUp).toBeNull()
  }, 10_000)
})
