import type { Appearance } from '@/shared/design-system'
import type { AppMode } from '@/app/useAppMode'
import type { BackgroundId } from '@/shared/design-system'
import { DEFAULT_DAILY_GOAL_MINUTES } from '@/features/stats/compute-stats'
import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'

export const SETTINGS_SCHEMA_VERSION = 1

export interface AppSettings {
  appearance: Appearance
  backgrounds: Record<AppMode, BackgroundId>
  activeTaskId: string | null
  dailyGoalMinutes: number
  timerSettings: TimerSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: 'system',
  backgrounds: { home: 'horizon', focus: 'horizon' },
  activeTaskId: null,
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  timerSettings: DEFAULT_TIMER_SETTINGS,
}
