import { getDb } from '@/shared/storage/db'

const RECORD_KEY = 'current'
const SCHEMA_VERSION = 1

export interface StoredNote {
  content: string
  updatedAt: number
}

export class IndexedDbNoteRepository {
  async load(): Promise<StoredNote | null> {
    const db = await getDb()
    const record = await db.get('notes', RECORD_KEY)
    if (!record) return null
    return { content: record.data, updatedAt: record.updatedAt }
  }

  async save(content: string, updatedAt: number): Promise<void> {
    const db = await getDb()
    await db.put('notes', { schemaVersion: SCHEMA_VERSION, data: content, updatedAt }, RECORD_KEY)
  }
}
