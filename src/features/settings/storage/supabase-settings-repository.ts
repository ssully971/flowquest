import { enqueueWrite } from '@/shared/sync/offline-queue'
import { supabase } from '@/shared/supabase/client'

import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from '../types'
import type { AppSettings } from '../types'
import type { StoredSettings } from './settings-repository'

/**
 * Lit les réglages distants (si connecté). N'écrit jamais directement en base : les
 * écritures passent par la file d'attente hors ligne (enqueueWrite), rejouée dès qu'une
 * connexion est disponible.
 */
export class SupabaseSettingsRepository {
  async load(userId: string): Promise<StoredSettings | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return {
      schemaVersion: data.schema_version,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings as unknown as AppSettings) },
      updatedAt: new Date(data.updated_at).getTime(),
    }
  }

  async save(userId: string, settings: AppSettings, updatedAt: number): Promise<void> {
    await enqueueWrite('user_settings', {
      user_id: userId,
      schema_version: SETTINGS_SCHEMA_VERSION,
      settings: settings as unknown as Record<string, unknown>,
      updated_at: new Date(updatedAt).toISOString(),
    })
  }
}
