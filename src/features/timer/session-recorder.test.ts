import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { getDb } from '@/shared/storage/db'

import type { TimerState } from './engine/timer-engine'

const upsertMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock }),
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

  it('ne synchronise vers Supabase que si un utilisateur est connecté', async () => {
    const { recordSession } = await import('./session-recorder')
    await recordSession(RUNNING_STATE, RUNNING_STATE.startedAt! + 60_000, false)
    expect(upsertMock).not.toHaveBeenCalled()

    setCurrentUserId('user-1')
    await recordSession(RUNNING_STATE, RUNNING_STATE.startedAt! + 60_000, false)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock.mock.calls[0][0].user_id).toBe('user-1')
  })
})
