import { getDb } from '@/shared/storage/db'
import type { CustomPhotoRecord } from '@/shared/storage/db'

/** Bibliothèque de photos personnelles (store IndexedDB `customPhotos`). */
export class IndexedDbCustomPhotoRepository {
  async list(): Promise<CustomPhotoRecord[]> {
    const db = await getDb()
    const photos = await db.getAll('customPhotos')
    return photos.sort((a, b) => a.createdAt - b.createdAt)
  }

  async put(record: CustomPhotoRecord): Promise<void> {
    const db = await getDb()
    await db.put('customPhotos', record)
  }

  async get(id: string): Promise<CustomPhotoRecord | null> {
    const db = await getDb()
    return (await db.get('customPhotos', id)) ?? null
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('customPhotos', id)
  }
}
