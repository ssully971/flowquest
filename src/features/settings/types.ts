import type { Appearance } from '@/shared/design-system'
import type { AppMode } from '@/app/useAppMode'
import type { BackgroundId } from '@/shared/design-system'
import { DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'
import type { ClockSettings } from '@/features/home/clock-settings'
import { DEFAULT_QUOTES_SETTINGS } from '@/features/home/quotes-settings'
import type { QuotesSettings } from '@/features/home/quotes-settings'
import { DEFAULT_DAILY_GOAL_MINUTES } from '@/features/stats/compute-stats'
import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'

import { DEFAULT_EXTRAS_SETTINGS } from './extras-settings'
import type { ExtrasSettings } from './extras-settings'

export const SETTINGS_SCHEMA_VERSION = 1

export interface AppSettings {
  appearance: Appearance
  backgrounds: Record<AppMode, BackgroundId>
  activeTaskId: string | null
  dailyGoalMinutes: number
  timerSettings: TimerSettings
  clockSettings: ClockSettings
  quotesSettings: QuotesSettings
  extrasSettings: ExtrasSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: 'system',
  backgrounds: { home: 'horizon', focus: 'horizon', ambient: 'horizon' },
  activeTaskId: null,
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  timerSettings: DEFAULT_TIMER_SETTINGS,
  clockSettings: DEFAULT_CLOCK_SETTINGS,
  quotesSettings: DEFAULT_QUOTES_SETTINGS,
  extrasSettings: DEFAULT_EXTRAS_SETTINGS,
}
