import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

import type { TimerState } from '@/features/timer/engine/timer-engine'

export interface StoredRecord<T> {
  schemaVersion: number
  data: T
  updatedAt: number
}

interface FlowquestDB extends DBSchema {
  timerState: {
    key: string
    value: StoredRecord<TimerState>
  }
}

const DB_NAME = 'flowquest'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<FlowquestDB>> | null = null

export function getDb(): Promise<IDBPDatabase<FlowquestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FlowquestDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('timerState')) {
          db.createObjectStore('timerState')
        }
      },
    })
  }
  return dbPromise
}
