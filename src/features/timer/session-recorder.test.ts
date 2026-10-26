import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { setActivePillarIdRef } from '@/features/pillars/active-pillar-ref'
import { IndexedDbPillarRepository } from '@/features/pillars/storage/indexed-db-pillar-repository'
import { getDb } from '@/shared/storage/db'
import type { PillarRecord } from '@/shared/storage/db'

import type { TimerState } from './engine/timer-engine'

const pillarRepo = new IndexedDbPillarRepository()

async function seedPillar(overrides: Partial<PillarRecord> = {}): Promise<PillarRecord> {
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
  await pillarRepo.put(pillar)
  return pillar
}

const upsertMock = vi.fn()
// Chaîne minimale pour pullOnePillar (reconcilePillarFromServer, appelé en tâche de
// fond après chaque upsert authentifié) : renvoie « rien trouvé » plutôt que de laisser
// l'appel planter sur une méthode manquante — ces tests portent sur recordSession, pas
// sur la réconciliation serveur elle-même (voir apply-session-xp.test.ts).
const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: upsertMock,
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    }),
  },
}))

const RUNNING_STATE: TimerState = {
  mode: 'pomodoro',
  segment: 'focus',
  durationMs: 1_500_000,
  startedAt: 1_700_000_000_000,
  pausedAt: null,
  pausedTotalMs: 0,
  status: 'running',
}

describe('recordSession', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    setCurrentUserId(null)
    const db = await getDb()
    const keys = await db.getAllKeys('focusSessions')
    await Promise.all(keys.map((key) => db.delete('focusSessions', key)))
    const queueKeys = await db.getAllKeys('syncQueue')
    await Promise.all(queueKeys.map((key) => db.delete('syncQueue', key)))
    const pillarKeys = await db.getAllKeys('pillars')
    await Promise.all(pillarKeys.map((key) => db.delete('pillars', key)))
    setActivePillarIdRef(null)
  })

  afterEach(() => {
    setActivePillarIdRef(null)
  })

  it('n’enregistre rien pour un segment jamais démarré', async () => {
    const { recordSession } = await import('./session-recorder')
    await recordSession({ ...RUNNING_STATE, startedAt: null }, Date.now(), false)

    const db = await getDb()
    expect(await db.count('focusSessions')).toBe(0)
  })

  it('enregistre une session terminée avec la durée réelle écoulée', async () => {
    const { recordSession } = await import('./session-recorder')
    const endedAt = RUNNING_STATE.startedAt! + 1_500_000
    await recordSession(RUNNING_STATE, endedAt, true)

    const db = await getDb()
    const sessions = await db.getAll('focusSessions')
    expect(sessions).toHaveLength(1)
    expect(sessions[0].completed).toBe(true)
    expect(sessions[0].actualSeconds).toBe(1500)
    expect(sessions[0].kind).toBe('focus')
  })

  it('enregistre une session abandonnée avec seulement le temps écoulé avant l’abandon', async () => {
    const { recordSession } = await import('./session-recorder')
    const endedAt = RUNNING_STATE.startedAt! + 300_000 // abandon après 5 min sur 25
    await recordSession(RUNNING_STATE, endedAt, false)

    const db = await getDb()
    const sessions = await db.getAll('focusSessions')
    expect(sessions[0].completed).toBe(false)
    expect(sessions[0].actualSeconds).toBe(300)
    expect(sessions[0].plannedSeconds).toBe(1500)
  })

  it('arrêt anticipé : le temps réellement écoulé est compté, ni 0 ni la durée planifiée (LOT E7)', async () => {
    const { recordSession } = await import('./session-recorder')
    // Pomodoro de 25 min, arrêté à 18 min.
    const endedAt = RUNNING_STATE.startedAt! + 18 * 60_000
    await recordSession(RUNNING_STATE, endedAt, false)

    const db = await getDb()
    const sessions = await db.getAll('focusSessions')
    expect(sessions[0].actualSeconds).toBe(18 * 60)
    expect(sessions[0].plannedSeconds).toBe(25 * 60)
  })

  it('pause puis arrêt : le temps passé en pause n’est jamais compté comme du focus (LOT E7)', async () => {
    const { recordSession } = await import('./session-recorder')
    // 10 min de focus, 5 min de pause (déjà reprise : pausedTotalMs à jour), puis encore
    // 8 min de focus avant l'arrêt : 18 min de focus réel, pas 23.
    const pausedState: TimerState = {
      ...RUNNING_STATE,
      pausedAt: null,
      pausedTotalMs: 5 * 60_000,
    }
    const endedAt = RUNNING_STATE.startedAt! + 10 * 60_000 + 5 * 60_000 + 8 * 60_000
    await recordSession(pausedState, endedAt, false)

    const db = await getDb()
    const sessions = await db.getAll('focusSessions')
    expect(sessions[0].actualSeconds).toBe(18 * 60)
  })

  it('arrêt pendant une pause : le temps resté en pause (même long) n’est pas compté (LOT E7)', async () => {
    const { recordSession } = await import('./session-recorder')
    // 10 min de focus, puis mise en pause ; l'arrêt arrive 1 h plus tard alors que la
    // session est toujours en pause (personne n'a touché "Lancer" entre-temps) — seules
    // les 10 min de focus réel doivent être comptées, pas l'heure passée en pause.
    const pausedAt = RUNNING_STATE.startedAt! + 10 * 60_000
    const stillPausedState: TimerState = {
      ...RUNNING_STATE,
      status: 'paused',
      pausedAt,
      pausedTotalMs: 0,
    }
    const endedAt = pausedAt + 60 * 60_000
    await recordSession(stillPausedState, endedAt, false)

    const db = await getDb()
    const sessions = await db.getAll('focusSessions')
    expect(sessions[0].actualSeconds).toBe(10 * 60)
  })

  it('ne synchronise vers Supabase que si un utilisateur est connecté', async () => {
    const { recordSession } = await import('./session-recorder')
    await recordSession(RUNNING_STATE, RUNNING_STATE.startedAt! + 60_000, false)
    expect(upsertMock).not.toHaveBeenCalled()

    setCurrentUserId('user-1')
    await recordSession(RUNNING_STATE, RUNNING_STATE.startedAt! + 60_000, false)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock.mock.calls[0][0].user_id).toBe('user-1')
  })

  describe('rattachement à un pilier (LOT G3)', () => {
    it('attache le pilier actif à une session de focus et crédite son XP (1 min = 10 XP)', async () => {
      await seedPillar()
      setActivePillarIdRef('pillar-1')
      const { recordSession } = await import('./session-recorder')

      const endedAt = RUNNING_STATE.startedAt! + 18 * 60_000 // 18 min réelles
      const result = await recordSession(RUNNING_STATE, endedAt, true)

      const db = await getDb()
      const sessions = await db.getAll('focusSessions')
      expect(sessions[0].pillarId).toBe('pillar-1')

      const pillars = await db.getAll('pillars')
      expect(pillars[0].currentXp).toBe(180) // 18 * 10

      expect(result).toEqual({
        pillarId: 'pillar-1',
        pillarName: 'Travail',
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
        goalReached: false,
        goalLevel: null,
      })
    })

    it('détecte un changement de niveau', async () => {
      // Niveau 2 atteint à 600 XP (voir pillar-xp.ts) : un pilier déjà à 590 XP passe
      // niveau 2 avec 1 min de focus supplémentaire (+10 XP).
      await seedPillar({ currentXp: 590, level: 1 })
      setActivePillarIdRef('pillar-1')
      const { recordSession } = await import('./session-recorder')

      const endedAt = RUNNING_STATE.startedAt! + 60_000 // 1 min
      const result = await recordSession(RUNNING_STATE, endedAt, true)

      expect(result?.leveledUp).toBe(true)
      expect(result?.newLevel).toBe(2)
    })

    it('n’attache aucun pilier à une pause, même avec un pilier actif', async () => {
      await seedPillar()
      setActivePillarIdRef('pillar-1')
      const { recordSession } = await import('./session-recorder')

      const pauseState: TimerState = { ...RUNNING_STATE, segment: 'short_break' }
      const result = await recordSession(pauseState, pauseState.startedAt! + 5 * 60_000, true)

      expect(result).toBeNull()
      const db = await getDb()
      const sessions = await db.getAll('focusSessions')
      expect(sessions[0].pillarId).toBeNull()
      const pillars = await db.getAll('pillars')
      expect(pillars[0].currentXp).toBe(0)
    })

    it('inclut pillar_id dans la charge envoyée à Supabase', async () => {
      await seedPillar()
      setActivePillarIdRef('pillar-1')
      setCurrentUserId('user-1')
      const { recordSession } = await import('./session-recorder')

      await recordSession(RUNNING_STATE, RUNNING_STATE.startedAt! + 60_000, true)

      expect(upsertMock.mock.calls[0][0].pillar_id).toBe('pillar-1')
    })

    it('sans pilier actif, la session n’a pas de pillar_id et rien n’est crédité', async () => {
      const { recordSession } = await import('./session-recorder')
      const result = await recordSession(RUNNING_STATE, RUNNING_STATE.startedAt! + 60_000, true)

      expect(result).toBeNull()
      const db = await getDb()
      const sessions = await db.getAll('focusSessions')
      expect(sessions[0].pillarId).toBeNull()
    })
  })
})
