import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord } from '@/shared/storage/db'

export class IndexedDbFocusSessionRepository {
  async add(record: FocusSessionRecord): Promise<void> {
    const db = await getDb()
    await db.put('focusSessions', record)
  }

  async listAll(): Promise<FocusSessionRecord[]> {
    const db = await getDb()
    return db.getAll('focusSessions')
  }
}
