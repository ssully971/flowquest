import { enqueueDelete, enqueueWrite } from '@/shared/sync/offline-queue'
import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

import type { TaskRecord } from '@/shared/storage/db'

function toRow(userId: string, task: TaskRecord): Database['public']['Tables']['tasks']['Insert'] {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    emoji: task.emoji,
    color: task.color,
    eta_minutes: task.etaMinutes,
    parent_id: task.parentId,
    position: task.position,
    done: task.done,
    done_at: task.doneAt ? new Date(task.doneAt).toISOString() : null,
    archived_at: task.archivedAt ? new Date(task.archivedAt).toISOString() : null,
  }
}

export async function pushTask(userId: string, task: TaskRecord): Promise<void> {
  await enqueueWrite('tasks', toRow(userId, task))
}

export async function deleteTaskRemote(id: string): Promise<void> {
  await enqueueDelete('tasks', id)
}

export async function pullAllTasks(userId: string): Promise<TaskRecord[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId)
  if (error || !data) return null

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    color: row.color,
    etaMinutes: row.eta_minutes,
    parentId: row.parent_id,
    position: row.position,
    done: row.done,
    doneAt: row.done_at ? new Date(row.done_at).getTime() : null,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }))
}
