import { Minus, Plus } from 'lucide-react'

import {
  FOCUS_MINUTES_RANGE,
  LONG_BREAK_MINUTES_RANGE,
  SESSIONS_BEFORE_LONG_BREAK_RANGE,
  SHORT_BREAK_MINUTES_RANGE,
} from '@/features/timer/timer-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'
import { strings } from '@/shared/i18n'

interface NumericStepperProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function NumericStepper({ label, value, min, max, step, unit, onChange }: NumericStepperProps) {
  const s = strings.settings.timer
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <span className="text-xs text-[var(--panel-muted)]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${s.decrease} : ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className="min-w-[4rem] text-center text-sm text-[var(--panel-text)]">
          {value} {unit}
        </span>
        <button
          type="button"
          aria-label={`${s.increase} : ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

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
      </div>

      <div className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--panel-text)]">{s.autoStartNext}</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoStartNext}
            aria-label={s.autoStartNext}
            onClick={() => onChange({ ...settings, autoStartNext: !settings.autoStartNext })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
              settings.autoStartNext ? 'bg-[var(--accent)]' : 'bg-[var(--panel-line)]'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                settings.autoStartNext ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--panel-muted)]">{s.autoStartNextHint}</p>
      </div>

      <div className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--panel-text)]">{s.showTaskInPip}</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.showTaskInPip}
            aria-label={s.showTaskInPip}
            onClick={() => onChange({ ...settings, showTaskInPip: !settings.showTaskInPip })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
              settings.showTaskInPip ? 'bg-[var(--accent)]' : 'bg-[var(--panel-line)]'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                settings.showTaskInPip ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--panel-muted)]">{s.showTaskInPipHint}</p>
      </div>
    </div>
  )
}
