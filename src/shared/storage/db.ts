import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

import type { TimerState } from '@/features/timer/engine/timer-engine'

export interface StoredRecord<T> {
  schemaVersion: number
  data: T
  updatedAt: number
}

export interface FocusSessionRecord {
  id: string
  kind: 'focus' | 'short_break' | 'long_break'
  plannedSeconds: number
  actualSeconds: number
  startedAt: number
  endedAt: number | null
  completed: boolean
  taskId: string | null
  syncedAt: number | null
}

export type SyncTable = 'user_settings' | 'timer_state' | 'focus_sessions'

export interface QueuedWrite {
  id: string
  table: SyncTable
  operation: 'upsert' | 'insert'
  payload: Record<string, unknown>
  createdAt: number
}

interface FlowquestDB extends DBSchema {
  timerState: {
    key: string
    value: StoredRecord<TimerState>
  }
  settings: {
    key: string
    value: StoredRecord<Record<string, unknown>>
  }
  focusSessions: {
    key: string
    value: FocusSessionRecord
    indexes: { startedAt: number }
  }
  syncQueue: {
    key: string
    value: QueuedWrite
  }
}

const DB_NAME = 'flowquest'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<FlowquestDB>> | null = null

export function getDb(): Promise<IDBPDatabase<FlowquestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FlowquestDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('timerState')) {
          db.createObjectStore('timerState')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
        if (!db.objectStoreNames.contains('focusSessions')) {
          const store = db.createObjectStore('focusSessions', { keyPath: 'id' })
          store.createIndex('startedAt', 'startedAt')
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}
