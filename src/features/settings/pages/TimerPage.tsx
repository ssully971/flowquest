import {
  COUNTDOWN_MINUTES_RANGE,
  FOCUS_MINUTES_RANGE,
  LONG_BREAK_MINUTES_RANGE,
  SESSIONS_BEFORE_LONG_BREAK_RANGE,
  SHORT_BREAK_MINUTES_RANGE,
} from '@/features/timer/timer-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'
import { SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { AlertSoundSettings } from './AlertSoundSettings'
import { NumericStepper } from './NumericStepper'
import { SessionGoalSettings } from './SessionGoalSettings'
import { TallyIconSetPicker } from './TallyIconSetPicker'
import { TimerDisplayStylePicker } from './TimerDisplayStylePicker'

interface TimerPageProps {
  settings: TimerSettings
  onChange: (settings: TimerSettings) => void
}

export function TimerPage({ settings, onChange }: TimerPageProps) {
  const s = strings.settings.timer

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <NumericStepper
          label={s.focusDuration}
          value={settings.focusMinutes}
          min={FOCUS_MINUTES_RANGE.min}
          max={FOCUS_MINUTES_RANGE.max}
          step={FOCUS_MINUTES_RANGE.step}
          unit="min"
          onChange={(focusMinutes) => onChange({ ...settings, focusMinutes })}
        />
        <NumericStepper
          label={s.shortBreakDuration}
          value={settings.shortBreakMinutes}
          min={SHORT_BREAK_MINUTES_RANGE.min}
          max={SHORT_BREAK_MINUTES_RANGE.max}
          step={SHORT_BREAK_MINUTES_RANGE.step}
          unit="min"
          onChange={(shortBreakMinutes) => onChange({ ...settings, shortBreakMinutes })}
        />
        <NumericStepper
          label={s.longBreakDuration}
          value={settings.longBreakMinutes}
          min={LONG_BREAK_MINUTES_RANGE.min}
          max={LONG_BREAK_MINUTES_RANGE.max}
          step={LONG_BREAK_MINUTES_RANGE.step}
          unit="min"
          onChange={(longBreakMinutes) => onChange({ ...settings, longBreakMinutes })}
        />
        <NumericStepper
          label={s.sessionsBeforeLongBreak}
          value={settings.sessionsBeforeLongBreak}
          min={SESSIONS_BEFORE_LONG_BREAK_RANGE.min}
          max={SESSIONS_BEFORE_LONG_BREAK_RANGE.max}
          step={SESSIONS_BEFORE_LONG_BREAK_RANGE.step}
          onChange={(sessionsBeforeLongBreak) => onChange({ ...settings, sessionsBeforeLongBreak })}
        />
        <NumericStepper
          label={s.countdownDuration}
          value={settings.countdownMinutes}
          min={COUNTDOWN_MINUTES_RANGE.min}
          max={COUNTDOWN_MINUTES_RANGE.max}
          step={COUNTDOWN_MINUTES_RANGE.step}
          unit="min"
          onChange={(countdownMinutes) => onChange({ ...settings, countdownMinutes })}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.displayStyle}</p>
        <TimerDisplayStylePicker
          value={settings.displayStyle}
          onChange={(displayStyle) => onChange({ ...settings, displayStyle })}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.tallyIconSet}</p>
        <TallyIconSetPicker
          value={settings.tallyIconSet}
          onChange={(tallyIconSet) => onChange({ ...settings, tallyIconSet })}
        />
      </div>

      <SettingsToggleRow
        label={s.autoStartNext}
        hint={s.autoStartNextHint}
        checked={settings.autoStartNext}
        onToggle={() => onChange({ ...settings, autoStartNext: !settings.autoStartNext })}
      />

      <SettingsToggleRow
        label={s.showTaskInPip}
        hint={s.showTaskInPipHint}
        checked={settings.showTaskInPip}
        onToggle={() => onChange({ ...settings, showTaskInPip: !settings.showTaskInPip })}
      />

      <SessionGoalSettings settings={settings} onChange={onChange} />

      <AlertSoundSettings settings={settings} onChange={onChange} />
    </div>
  )
}
