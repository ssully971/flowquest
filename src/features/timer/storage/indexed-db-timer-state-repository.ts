import { getDb } from '@/shared/storage/db'

import type { TimerState } from '../engine/timer-engine'
import type { TimerStateRepository } from './timer-state-repository'

const RECORD_KEY = 'current'
const SCHEMA_VERSION = 1

export class IndexedDbTimerStateRepository implements TimerStateRepository {
  async load(): Promise<TimerState | null> {
    const db = await getDb()
    const record = await db.get('timerState', RECORD_KEY)
    return record?.data ?? null
  }

  async save(state: TimerState): Promise<void> {
    const db = await getDb()
    await db.put(
      'timerState',
      { schemaVersion: SCHEMA_VERSION, data: state, updatedAt: Date.now() },
      RECORD_KEY,
    )
  }

  async clear(): Promise<void> {
    const db = await getDb()
    await db.delete('timerState', RECORD_KEY)
  }
}
