import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

import type { TimerState } from '../engine/timer-engine'

const upsertMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock }),
  },
}))

const SAMPLE_STATE: TimerState = {
  mode: 'pomodoro',
  segment: 'focus',
  durationMs: 1_500_000,
  startedAt: 1_700_000_000_000,
  pausedAt: null,
  pausedTotalMs: 0,
  status: 'running',
}

describe('SyncingTimerStateRepository — local toujours, distant seulement si connecté', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    const db = await getDb()
    await db.delete('timerState', 'current')
    const keys = await db.getAllKeys('syncQueue')
    await Promise.all(keys.map((key) => db.delete('syncQueue', key)))
  })

  it('écrit toujours en local, même sans utilisateur connecté (mode invité)', async () => {
    const { SyncingTimerStateRepository } = await import('./syncing-timer-state-repository')
    const repo = new SyncingTimerStateRepository(() => null)

    await repo.save(SAMPLE_STATE)

    expect(await repo.load()).toEqual(SAMPLE_STATE)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('synchronise aussi vers Supabase quand un utilisateur est connecté', async () => {
    const { SyncingTimerStateRepository } = await import('./syncing-timer-state-repository')
    const repo = new SyncingTimerStateRepository(() => 'user-1')

    await repo.save(SAMPLE_STATE, 1_700_000_000_000)

    expect(upsertMock).toHaveBeenCalledTimes(1)
    const payload = upsertMock.mock.calls[0][0]
    expect(payload.user_id).toBe('user-1')
    expect(payload.status).toBe('running')
  })
})
