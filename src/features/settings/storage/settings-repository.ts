import type { AppSettings } from '../types'

export interface StoredSettings {
  schemaVersion: number
  settings: AppSettings
  updatedAt: number
}

export interface SettingsRepository {
  load(): Promise<StoredSettings | null>
  save(settings: AppSettings, updatedAt: number): Promise<void>
}
