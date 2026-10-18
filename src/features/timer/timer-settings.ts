import { ALERT_SOUNDS } from './alert-sounds'
import { POMODORO_DEFAULTS } from './durations'
import type { PomodoroDurationsMs } from './durations'
import { SESSION_GOAL_TYPES } from './session-goal'
import type { SessionGoalType } from './session-goal'
import { TALLY_ICON_SETS } from './tally-icon-set'
import type { TallyIconSet } from './tally-icon-set'
import { TIMER_DISPLAY_STYLES } from './timer-display-style'
import type { TimerDisplayStyle } from './timer-display-style'

export interface TimerSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
  countdownMinutes: number
  autoStartNext: boolean
  showTaskInPip: boolean
  displayStyle: TimerDisplayStyle
  tallyIconSet: TallyIconSet
  soundEnabled: boolean
  notificationsEnabled: boolean
  alertSoundId: string
  alertVolume: number
  sessionGoalType: SessionGoalType
  sessionGoalCount: number
  sessionGoalMinutes: number
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusMinutes: POMODORO_DEFAULTS.focusMs / 60_000,
  shortBreakMinutes: POMODORO_DEFAULTS.shortBreakMs / 60_000,
  longBreakMinutes: POMODORO_DEFAULTS.longBreakMs / 60_000,
  sessionsBeforeLongBreak: POMODORO_DEFAULTS.sessionsBeforeLongBreak,
  countdownMinutes: 20,
  autoStartNext: false,
  showTaskInPip: true,
  displayStyle: 'default',
  tallyIconSet: 'dots',
  soundEnabled: true,
  notificationsEnabled: true,
  alertSoundId: ALERT_SOUNDS[0].id,
  alertVolume: 0.7,
  sessionGoalType: 'none',
  sessionGoalCount: 4,
  sessionGoalMinutes: 120,
}

export { TIMER_DISPLAY_STYLES, TALLY_ICON_SETS, SESSION_GOAL_TYPES }
export type { TimerDisplayStyle, TallyIconSet, SessionGoalType }

// Plages du §6.1 du cahier des charges.
export const FOCUS_MINUTES_RANGE = { min: 10, max: 100, step: 5 }
export const SHORT_BREAK_MINUTES_RANGE = { min: 1, max: 20, step: 1 }
export const LONG_BREAK_MINUTES_RANGE = { min: 20, max: 40, step: 5 }
export const SESSIONS_BEFORE_LONG_BREAK_RANGE = { min: 2, max: 8, step: 1 }
// Durée libre du mode Compte à rebours (lot 4) : 1 min à 3 h.
export const COUNTDOWN_MINUTES_RANGE = { min: 1, max: 180, step: 1 }
// Objectif de session (lot 4) : en nombre de sessions, ou en durée totale de focus visée.
export const SESSION_GOAL_COUNT_RANGE = { min: 1, max: 12, step: 1 }
export const SESSION_GOAL_MINUTES_RANGE = { min: 30, max: 480, step: 15 }

export function toDurationsMs(settings: TimerSettings): PomodoroDurationsMs {
  return {
    focusMs: settings.focusMinutes * 60_000,
    shortBreakMs: settings.shortBreakMinutes * 60_000,
    longBreakMs: settings.longBreakMinutes * 60_000,
  }
}
