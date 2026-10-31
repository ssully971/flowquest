import { getDb } from '@/shared/storage/db'
import type { ConstellationLayoutRecord, TaskLinkRecord } from '@/shared/storage/db'

const LAYOUT_KEY = 'current'

/** Liens entre tâches et positions des nœuds, en local (IndexedDB) : seul stockage d'un
 * invité, miroir local d'un compte connecté. */
export class IndexedDbConstellationRepository {
  async listLinks(): Promise<TaskLinkRecord[]> {
    const db = await getDb()
    return db.getAll('taskLinks')
  }

  async putLink(link: TaskLinkRecord): Promise<void> {
    const db = await getDb()
    await db.put('taskLinks', link)
  }

  async putLinks(links: TaskLinkRecord[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction('taskLinks', 'readwrite')
    await Promise.all(links.map((link) => tx.store.put(link)))
    await tx.done
  }

  async removeLink(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('taskLinks', id)
  }

  /** Supprime tous les liens qui touchent l'une des tâches (suppression de tâche : le serveur
   * le fait en cascade, IndexedDB ne connaît pas les contraintes). Renvoie les ids retirés. */
  async removeLinksOfTasks(taskIds: string[]): Promise<string[]> {
    const db = await getDb()
    const all = await db.getAll('taskLinks')
    const ids = new Set(taskIds)
    const doomed = all.filter((link) => ids.has(link.fromTaskId) || ids.has(link.toTaskId))
    await Promise.all(doomed.map((link) => db.delete('taskLinks', link.id)))
    return doomed.map((link) => link.id)
  }

  async getLayout(): Promise<ConstellationLayoutRecord | null> {
    const db = await getDb()
    return (await db.get('constellationLayout', LAYOUT_KEY)) ?? null
  }

  async putLayout(layout: ConstellationLayoutRecord): Promise<void> {
    const db = await getDb()
    await db.put('constellationLayout', layout, LAYOUT_KEY)
  }
}
