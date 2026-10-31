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
  pillarId: string | null
  /** Temps de pause (s) et nombre de pauses manuelles — absents des sessions enregistrées avant
   * la migration 0052 (comptés 0). */
  pausedSeconds?: number
  pauseCount?: number
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
  /** Tâche archivée (masquée de la liste active, restaurable) ; absent ou `null` = active. */
  archivedAt?: number | null
  /** Pilier rattaché (optionnel) ; `null`/absent = aucun. */
  pillarId?: string | null
  createdAt: number
  updatedAt: number
}

/** Lien entre deux tâches (constellation) : `depends_on` = « from dépend de to » (orienté),
 * `related` = « lié à » (symétrique, from < to par convention). */
export interface TaskLinkRecord {
  id: string
  fromTaskId: string
  toTaskId: string
  kind: 'depends_on' | 'related'
  createdAt: number
}

/** Positions enregistrées des nœuds de la constellation (id de tâche ou de pilier → x, y). */
export interface ConstellationLayoutRecord {
  positions: Record<string, { x: number; y: number; pinned?: boolean }>
  updatedAt: number
}

export interface PillarRecord {
  id: string
  name: string
  color: string
  currentXp: number
  level: number
  createdAt: number
  archivedAt: number | null
  /** Objectif de niveau (lot 4, §4) : `null` si aucun objectif fixé. */
  goalLevel: number | null
  /** Date limite optionnelle de l'objectif (ms epoch), `null` si aucune — un objectif
   * peut être fixé sans date limite (juste un niveau visé). */
  goalDeadline: number | null
}

export type SyncTable =
  | 'user_settings'
  | 'timer_state'
  | 'focus_sessions'
  | 'tasks'
  | 'notes'
  | 'pillars'
  | 'task_links'
  | 'constellation_layouts'

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

/** Photo de la bibliothèque de fonds personnels (plusieurs, contre un seul emplacement avant). */
export interface CustomPhotoRecord {
  id: string
  /** Image redimensionnée (2560 px max, webp). */
  blob: Blob
  /** Vignette (≈ 320 px) pour la grille de la bibliothèque. */
  thumb: Blob
  position: CustomBackgroundPosition
  /** Poids total stocké (image + vignette), pour le plafond de la bibliothèque. */
  size: number
  createdAt: number
}

interface FokitsuDB extends DBSchema {
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
  pillars: {
    key: string
    value: PillarRecord
  }
  customPhotos: {
    key: string
    value: CustomPhotoRecord
  }
  taskLinks: {
    key: string
    value: TaskLinkRecord
  }
  constellationLayout: {
    key: string
    value: ConstellationLayoutRecord
  }
}

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const DB_NAME = 'flowquest'
const DB_VERSION = 8

let dbPromise: Promise<IDBPDatabase<FokitsuDB>> | null = null

export function getDb(): Promise<IDBPDatabase<FokitsuDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FokitsuDB>(DB_NAME, DB_VERSION, {
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
        if (!db.objectStoreNames.contains('pillars')) {
          db.createObjectStore('pillars', { keyPath: 'id' })
        }
        // v7 : bibliothèque de photos personnelles. L'ancien fond unique (store
        // `customBackground`) n'est pas touché ici : il est repris dans la bibliothèque, puis
        // supprimé, au premier chargement (voir CustomBackgroundProvider) — migration douce.
        if (!db.objectStoreNames.contains('customPhotos')) {
          db.createObjectStore('customPhotos', { keyPath: 'id' })
        }
        // v8 : constellation (liens entre tâches, positions des nœuds).
        if (!db.objectStoreNames.contains('taskLinks')) {
          db.createObjectStore('taskLinks', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('constellationLayout')) {
          db.createObjectStore('constellationLayout')
        }
      },
    })
  }
  return dbPromise
}
