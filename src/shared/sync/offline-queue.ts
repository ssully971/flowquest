import { getDb } from '@/shared/storage/db'
import type { QueuedWrite, SyncTable } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

type PayloadFor<T extends SyncTable> = Database['public']['Tables'][T]['Insert']

function generateId(): string {
  return crypto.randomUUID()
}

async function enqueue(entry: QueuedWrite): Promise<void> {
  if (!supabase) return // Mode invité : rien à synchroniser.
  const db = await getDb()
  await db.put('syncQueue', entry)
  await flushQueue()
}

/**
 * Ajoute une écriture à la file d'attente locale (IndexedDB) puis tente de la
 * synchroniser immédiatement si une connexion est disponible. L'écriture reste en
 * file tant qu'elle n'a pas réussi : aucune perte silencieuse, même en cas de
 * fermeture de l'onglet avant la synchronisation.
 */
export async function enqueueWrite<T extends SyncTable>(
  table: T,
  payload: PayloadFor<T>,
): Promise<void> {
  await enqueue({
    id: generateId(),
    table,
    operation: 'upsert',
    payload: payload as Record<string, unknown>,
    createdAt: Date.now(),
  })
}

/** Supprime une ligne `tasks`/`pillars` par id, via la même file (jamais en direct). */
export async function enqueueDelete(
  table: 'tasks' | 'pillars' | 'task_links',
  recordId: string,
): Promise<void> {
  await enqueue({
    id: generateId(),
    table,
    operation: 'delete',
    payload: { id: recordId },
    createdAt: Date.now(),
  })
}

let isFlushing = false

async function sendToSupabase(entry: QueuedWrite): Promise<{ message: string } | null> {
  if (!supabase) return null

  if (entry.operation === 'delete') {
    if (
      entry.table !== 'tasks' &&
      entry.table !== 'pillars' &&
      entry.table !== 'task_links'
    ) {
      return null
    }
    const { error } = await supabase
      .from(entry.table)
      .delete()
      .eq('id', entry.payload.id as string)
    return error
  }

  switch (entry.table) {
    case 'user_settings': {
      const { error } = await supabase
        .from('user_settings')
        .upsert(entry.payload as Database['public']['Tables']['user_settings']['Insert'])
      return error
    }
    case 'timer_state': {
      const { error } = await supabase
        .from('timer_state')
        .upsert(entry.payload as Database['public']['Tables']['timer_state']['Insert'])
      return error
    }
    case 'focus_sessions': {
      const { error } = await supabase
        .from('focus_sessions')
        .upsert(entry.payload as Database['public']['Tables']['focus_sessions']['Insert'])
      return error
    }
    case 'tasks': {
      const { error } = await supabase
        .from('tasks')
        .upsert(entry.payload as Database['public']['Tables']['tasks']['Insert'])
      return error
    }
    case 'notes': {
      const { error } = await supabase
        .from('notes')
        .upsert(entry.payload as Database['public']['Tables']['notes']['Insert'])
      return error
    }
    case 'pillars': {
      const { error } = await supabase
        .from('pillars')
        .upsert(entry.payload as Database['public']['Tables']['pillars']['Insert'])
      return error
    }
    case 'task_links': {
      const { error } = await supabase
        .from('task_links')
        .upsert(entry.payload as Database['public']['Tables']['task_links']['Insert'])
      return error
    }
    case 'constellation_layouts': {
      const { error } = await supabase
        .from('constellation_layouts')
        .upsert(entry.payload as Database['public']['Tables']['constellation_layouts']['Insert'])
      return error
    }
    default:
      return null
  }
}

/**
 * Rejoue la file d'attente dans l'ordre. S'arrête à la première erreur (réseau ou
 * base indisponible) pour réessayer plus tard, plutôt que de retirer silencieusement
 * une écriture qui n'a pas abouti.
 */
export async function flushQueue(): Promise<void> {
  if (!supabase) return
  if (isFlushing) return
  isFlushing = true
  try {
    const db = await getDb()
    const entries = await db.getAll('syncQueue')
    entries.sort((a, b) => a.createdAt - b.createdAt)
    for (const entry of entries) {
      const error = await sendToSupabase(entry)
      if (error) break
      await db.delete('syncQueue', entry.id)
    }
  } finally {
    isFlushing = false
  }
}

export async function pendingWriteCount(): Promise<number> {
  const db = await getDb()
  return db.count('syncQueue')
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushQueue())
}
