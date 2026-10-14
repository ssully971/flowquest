import { getDb } from '@/shared/storage/db'

import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from '../types'
import type { AppSettings } from '../types'
import type { SettingsRepository, StoredSettings } from './settings-repository'

const RECORD_KEY = 'current'

export class IndexedDbSettingsRepository implements SettingsRepository {
  async load(): Promise<StoredSettings | null> {
    const db = await getDb()
    const record = await db.get('settings', RECORD_KEY)
    if (!record) return null
    return {
      schemaVersion: record.schemaVersion,
      settings: { ...DEFAULT_SETTINGS, ...(record.data as unknown as AppSettings) },
      updatedAt: record.updatedAt,
    }
  }

  async save(settings: AppSettings, updatedAt: number): Promise<void> {
    const db = await getDb()
    await db.put(
      'settings',
      {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        data: settings as unknown as Record<string, unknown>,
        updatedAt,
      },
      RECORD_KEY,
    )
  }
}
