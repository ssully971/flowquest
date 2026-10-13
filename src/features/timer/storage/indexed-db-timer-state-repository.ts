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

  /** Comme load(), mais expose aussi updatedAt : utile pour comparer avec l'état distant. */
  async loadWithMeta(): Promise<{ state: TimerState; updatedAt: number } | null> {
    const db = await getDb()
    const record = await db.get('timerState', RECORD_KEY)
    if (!record) return null
    return { state: record.data, updatedAt: record.updatedAt }
  }

  async save(state: TimerState, updatedAt: number = Date.now()): Promise<void> {
    const db = await getDb()
    await db.put(
      'timerState',
      { schemaVersion: SCHEMA_VERSION, data: state, updatedAt },
      RECORD_KEY,
    )
  }

  async clear(): Promise<void> {
    const db = await getDb()
    await db.delete('timerState', RECORD_KEY)
  }
}
