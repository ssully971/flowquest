import { getDb } from '@/shared/storage/db'
import type { QueuedWrite, SyncTable } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

type PayloadFor<T extends SyncTable> = Database['public']['Tables'][T]['Insert']

function generateId(): string {
  return crypto.randomUUID()
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
  if (!supabase) return // Mode invité : rien à synchroniser.
  const db = await getDb()
  const entry: QueuedWrite = {
    id: generateId(),
    table,
    operation: 'upsert',
    payload: payload as Record<string, unknown>,
    createdAt: Date.now(),
  }
  await db.put('syncQueue', entry)
  await flushQueue()
}

let isFlushing = false

async function sendToSupabase(entry: QueuedWrite): Promise<{ message: string } | null> {
  if (!supabase) return null
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
