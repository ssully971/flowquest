import type { Appearance } from '@/shared/design-system'
import type { AppMode } from '@/app/useAppMode'
import type { BackgroundId } from '@/shared/design-system'

export const SETTINGS_SCHEMA_VERSION = 1

export interface AppSettings {
  appearance: Appearance
  backgrounds: Record<AppMode, BackgroundId>
  activeTaskId: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: 'system',
  backgrounds: { home: 'horizon', focus: 'horizon' },
  activeTaskId: null,
}
