import { supabase } from '@/shared/supabase/client'
import type { ConstellationLayoutRecord, TaskLinkRecord } from '@/shared/storage/db'
import { enqueueDelete, enqueueWrite } from '@/shared/sync/offline-queue'

export async function pushTaskLink(userId: string, link: TaskLinkRecord): Promise<void> {
  await enqueueWrite('task_links', {
    id: link.id,
    user_id: userId,
    from_task_id: link.fromTaskId,
    to_task_id: link.toTaskId,
    kind: link.kind,
  })
}

export async function deleteTaskLinkRemote(id: string): Promise<void> {
  await enqueueDelete('task_links', id)
}

export async function pushLayout(userId: string, layout: ConstellationLayoutRecord): Promise<void> {
  await enqueueWrite('constellation_layouts', {
    user_id: userId,
    positions: layout.positions,
    updated_at: new Date(layout.updatedAt).toISOString(),
  })
}

export async function pullTaskLinks(userId: string): Promise<TaskLinkRecord[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('task_links').select('*').eq('user_id', userId)
  if (error || !data) return null
  return data.map((row) => ({
    id: row.id,
    fromTaskId: row.from_task_id,
    toTaskId: row.to_task_id,
    kind: row.kind,
    createdAt: new Date(row.created_at).getTime(),
  }))
}

export async function pullLayout(userId: string): Promise<ConstellationLayoutRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('constellation_layouts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return { positions: data.positions ?? {}, updatedAt: new Date(data.updated_at).getTime() }
}
