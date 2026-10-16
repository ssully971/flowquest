import { getDb } from '@/shared/storage/db'
import type { TaskRecord } from '@/shared/storage/db'

export class IndexedDbTaskRepository {
  async listAll(): Promise<TaskRecord[]> {
    const db = await getDb()
    const tasks = await db.getAll('tasks')
    return tasks.sort((a, b) => a.position - b.position)
  }

  async put(task: TaskRecord): Promise<void> {
    const db = await getDb()
    await db.put('tasks', task)
  }

  async putMany(tasks: TaskRecord[]): Promise<void> {
    const db = await getDb()
    const tx = db.transaction('tasks', 'readwrite')
    await Promise.all(tasks.map((task) => tx.store.put(task)))
    await tx.done
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('tasks', id)
  }
}
