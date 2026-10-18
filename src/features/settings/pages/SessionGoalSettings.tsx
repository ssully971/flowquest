import {
  computeSessionGoalPlan,
  formatPlanDuration,
} from '@/features/timer/session-goal'
import {
  SESSION_GOAL_COUNT_RANGE,
  SESSION_GOAL_MINUTES_RANGE,
  toDurationsMs,
} from '@/features/timer/timer-settings'
import type { SessionGoalType, TimerSettings } from '@/features/timer/timer-settings'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'
import { NumericStepper } from './NumericStepper'

interface SessionGoalSettingsProps {
  settings: TimerSettings
  onChange: (settings: TimerSettings) => void
}

export function SessionGoalSettings({ settings, onChange }: SessionGoalSettingsProps) {
  const s = strings.settings.timer.sessionGoal

  const TYPE_OPTIONS: { value: SessionGoalType; label: string }[] = [
    { value: 'none', label: s.none },
    { value: 'count', label: s.byCount },
    { value: 'duration', label: s.byDuration },
  ]

  const plan = computeSessionGoalPlan({
    goalType: settings.sessionGoalType,
    goalCount: settings.sessionGoalCount,
    goalMinutes: settings.sessionGoalMinutes,
    durations: toDurationsMs(settings),
    sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
  })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--panel-muted)]">{s.title}</p>

      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((option) => (
          <CategoryChip
            key={option.value}
            label={option.label}
            active={option.value === settings.sessionGoalType}
            onClick={() => onChange({ ...settings, sessionGoalType: option.value })}
          />
        ))}
      </div>

      {settings.sessionGoalType === 'count' ? (
        <NumericStepper
          label={s.sessionsLabel}
          value={settings.sessionGoalCount}
          min={SESSION_GOAL_COUNT_RANGE.min}
          max={SESSION_GOAL_COUNT_RANGE.max}
          step={SESSION_GOAL_COUNT_RANGE.step}
          onChange={(sessionGoalCount) => onChange({ ...settings, sessionGoalCount })}
        />
      ) : null}

      {settings.sessionGoalType === 'duration' ? (
        <NumericStepper
          label={s.minutesLabel}
          value={settings.sessionGoalMinutes}
          min={SESSION_GOAL_MINUTES_RANGE.min}
          max={SESSION_GOAL_MINUTES_RANGE.max}
          step={SESSION_GOAL_MINUTES_RANGE.step}
          unit="min"
          onChange={(sessionGoalMinutes) => onChange({ ...settings, sessionGoalMinutes })}
        />
      ) : null}

      {plan ? (
        <p className="text-xs text-[var(--panel-muted)]">
          {plan.focusSessions} {plan.focusSessions === 1 ? s.planSessions : s.planSessionsPlural}
          {plan.shortBreaks > 0
            ? ` · ${plan.shortBreaks} ${plan.shortBreaks === 1 ? s.planShortBreak : s.planShortBreakPlural}`
            : ''}
          {plan.longBreaks > 0
            ? ` · ${plan.longBreaks} ${plan.longBreaks === 1 ? s.planLongBreak : s.planLongBreakPlural}`
            : ''}
          {` · ~${formatPlanDuration(plan.totalMs)} ${s.planTotal}`}
        </p>
      ) : null}
    </div>
  )
}
