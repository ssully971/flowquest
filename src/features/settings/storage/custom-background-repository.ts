import { getDb } from '@/shared/storage/db'
import type { CustomBackgroundRecord } from '@/shared/storage/db'

const RECORD_KEY = 'current'

export class IndexedDbCustomBackgroundRepository {
  async load(): Promise<CustomBackgroundRecord | null> {
    const db = await getDb()
    const record = await db.get('customBackground', RECORD_KEY)
    return record ?? null
  }

  async save(record: CustomBackgroundRecord): Promise<void> {
    const db = await getDb()
    await db.put('customBackground', record, RECORD_KEY)
  }

  async remove(): Promise<void> {
    const db = await getDb()
    await db.delete('customBackground', RECORD_KEY)
  }
}
