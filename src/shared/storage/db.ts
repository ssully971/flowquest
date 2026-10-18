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

export interface TaskRecord {
  id: string
  title: string
  emoji: string | null
  color: string | null
  etaMinutes: number | null
  parentId: string | null
  position: number
  done: boolean
  doneAt: number | null
  createdAt: number
  updatedAt: number
}

export type SyncTable = 'user_settings' | 'timer_state' | 'focus_sessions' | 'tasks' | 'notes'

export interface QueuedWrite {
  id: string
  table: SyncTable
  operation: 'upsert' | 'delete'
  payload: Record<string, unknown>
  createdAt: number
}

export type CustomBackgroundPosition = 'top' | 'center' | 'bottom'

export interface CustomBackgroundRecord {
  blob: Blob
  position: CustomBackgroundPosition
  updatedAt: number
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
  tasks: {
    key: string
    value: TaskRecord
    indexes: { position: number }
  }
  notes: {
    key: string
    value: StoredRecord<string>
  }
  syncQueue: {
    key: string
    value: QueuedWrite
  }
  customBackground: {
    key: string
    value: CustomBackgroundRecord
  }
}

const DB_NAME = 'flowquest'
const DB_VERSION = 5

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
        if (!db.objectStoreNames.contains('tasks')) {
          const store = db.createObjectStore('tasks', { keyPath: 'id' })
          store.createIndex('position', 'position')
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes')
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('customBackground')) {
          db.createObjectStore('customBackground')
        }
      },
    })
  }
  return dbPromise
}
