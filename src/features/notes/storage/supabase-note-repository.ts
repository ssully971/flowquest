import { enqueueWrite } from '@/shared/sync/offline-queue'
import { supabase } from '@/shared/supabase/client'

import type { StoredNote } from './indexed-db-note-repository'

export class SupabaseNoteRepository {
  async load(userId: string): Promise<StoredNote | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return { content: data.content, updatedAt: new Date(data.updated_at).getTime() }
  }

  async save(userId: string, content: string, updatedAt: number): Promise<void> {
    await enqueueWrite('notes', {
      user_id: userId,
      content,
      updated_at: new Date(updatedAt).toISOString(),
    })
  }
}
