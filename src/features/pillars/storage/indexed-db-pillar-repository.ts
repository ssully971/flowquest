import { getDb } from '@/shared/storage/db'
import type { PillarRecord } from '@/shared/storage/db'

export class IndexedDbPillarRepository {
  async listAll(): Promise<PillarRecord[]> {
    const db = await getDb()
    const pillars = await db.getAll('pillars')
    return pillars.sort((a, b) => a.createdAt - b.createdAt)
  }

  async put(pillar: PillarRecord): Promise<void> {
    const db = await getDb()
    await db.put('pillars', pillar)
  }

  async putMany(pillars: PillarRecord[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction('pillars', 'readwrite')
    await Promise.all(pillars.map((pillar) => tx.store.put(pillar)))
    await tx.done
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('pillars', id)
  }
}
