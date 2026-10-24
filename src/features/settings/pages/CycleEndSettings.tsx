import { SESSIONS_BEFORE_LONG_BREAK_RANGE } from '@/features/timer/timer-settings'
import type { CycleEndMode, TimerSettings } from '@/features/timer/timer-settings'
import { SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'
import { NumericStepper } from './NumericStepper'

interface CycleEndSettingsProps {
  settings: TimerSettings
  onChange: (settings: TimerSettings) => void
}

/**
 * Réglage « Fin de cycle » (LOT E5) : ce qui se passe après N sessions de focus séparées
 * par des pauses courtes — jamais un enchaînement sans fin ni une pause longue imposée
 * sans que l'utilisateur l'ait choisi.
 */
export function CycleEndSettings({ settings, onChange }: CycleEndSettingsProps) {
  const s = strings.settings.timer.cycleEnd

  const MODE_OPTIONS: { value: CycleEndMode; label: string }[] = [
    { value: 'longBreakAfterN', label: s.longBreakAfterN },
    { value: 'stopAfterN', label: s.stopAfterN },
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--panel-muted)]">{s.title}</p>

      <div className="flex flex-wrap gap-2">
        {MODE_OPTIONS.map((option) => (
          <CategoryChip
            key={option.value}
            label={option.label}
            active={option.value === settings.cycleEndMode}
            onClick={() => onChange({ ...settings, cycleEndMode: option.value })}
          />
        ))}
      </div>

      {settings.cycleEndMode === 'longBreakAfterN' ? (
        <>
          <SettingsToggleRow
            label={s.unlimited}
            hint={s.unlimitedHint}
            checked={settings.cycleEndUnlimited}
            onToggle={() => onChange({ ...settings, cycleEndUnlimited: !settings.cycleEndUnlimited })}
          />
          {!settings.cycleEndUnlimited ? (
            <NumericStepper
              label={s.sessionsLabel}
              value={settings.sessionsBeforeLongBreak}
              min={SESSIONS_BEFORE_LONG_BREAK_RANGE.min}
              max={SESSIONS_BEFORE_LONG_BREAK_RANGE.max}
              step={SESSIONS_BEFORE_LONG_BREAK_RANGE.step}
              onChange={(sessionsBeforeLongBreak) => onChange({ ...settings, sessionsBeforeLongBreak })}
            />
          ) : null}
        </>
      ) : (
        <>
          <NumericStepper
            label={s.sessionsLabel}
            value={settings.sessionsBeforeLongBreak}
            min={SESSIONS_BEFORE_LONG_BREAK_RANGE.min}
            max={SESSIONS_BEFORE_LONG_BREAK_RANGE.max}
            step={SESSIONS_BEFORE_LONG_BREAK_RANGE.step}
            onChange={(sessionsBeforeLongBreak) => onChange({ ...settings, sessionsBeforeLongBreak })}
          />
          <p className="text-xs text-[var(--panel-muted)]">{s.stopAfterNHint}</p>
        </>
      )}
    </div>
  )
}
