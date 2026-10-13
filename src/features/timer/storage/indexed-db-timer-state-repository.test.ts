import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { createTimerState, start } from '../engine/timer-engine'
import { IndexedDbTimerStateRepository } from './indexed-db-timer-state-repository'

const repository = new IndexedDbTimerStateRepository()

beforeEach(async () => {
  await repository.clear()
})

describe('IndexedDbTimerStateRepository', () => {
  it('retourne null quand rien n’a été persisté', async () => {
    expect(await repository.load()).toBeNull()
  })

  it('persiste puis recharge un état identique', async () => {
    const state = start(createTimerState('pomodoro', 'focus', 25 * 60_000), 1_000_000)

    await repository.save(state)
    const reloaded = await repository.load()

    expect(reloaded).toEqual(state)
  })

  it('clear() efface l’état persisté', async () => {
    const state = start(createTimerState('countdown', 'countdown', 5 * 60_000), 0)
    await repository.save(state)

    await repository.clear()

    expect(await repository.load()).toBeNull()
  })

  it('écrit un numéro de version avec les données stockées', async () => {
    const state = createTimerState('stopwatch', 'stopwatch', null)
    await repository.save(state)

    const { getDb } = await import('@/shared/storage/db')
    const db = await getDb()
    const record = await db.get('timerState', 'current')

    expect(record?.schemaVersion).toBe(1)
    expect(typeof record?.updatedAt).toBe('number')
  })
})
