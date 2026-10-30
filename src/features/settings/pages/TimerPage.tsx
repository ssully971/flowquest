import { useState } from 'react'

import { LockedBadge } from '@/features/access/LockedBadge'
import { useFeatureAccess } from '@/features/access/useFeatureAccess'
import { KeyboardShortcutsHelp } from '@/features/timer/components/KeyboardShortcutsHelp'
import {
  COUNTDOWN_MINUTES_RANGE,
  DEEP_FOCUS_GRACE_SECONDS_RANGE,
  FOCUS_MINUTES_RANGE,
  LONG_BREAK_MINUTES_RANGE,
  SHORT_BREAK_MINUTES_RANGE,
} from '@/features/timer/timer-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'
import { SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { AlertSoundSettings } from './AlertSoundSettings'
import { CycleEndSettings } from './CycleEndSettings'
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
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)
  const { isLocked, requireAccount } = useFeatureAccess()
  const deepFocusLocked = isLocked('deepFocus')

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

      <div className="flex max-w-md flex-col gap-2">
        <SettingsToggleRow
          label={s.keyboardShortcutsEnabled}
          hint={s.keyboardShortcutsEnabledHint}
          checked={settings.keyboardShortcutsEnabled}
          onToggle={() =>
            onChange({ ...settings, keyboardShortcutsEnabled: !settings.keyboardShortcutsEnabled })
          }
        />
        <button
          type="button"
          onClick={() => setIsShortcutsHelpOpen(true)}
          className="self-start text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {strings.focus.shortcuts.openHelp}
        </button>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        {/* Verrouillé (invité) : l'interrupteur s'affiche éteint et ouvre la modale d'upsell
            au lieu de basculer ; le réglage stocké n'est jamais modifié. */}
        <div className={deepFocusLocked ? 'relative opacity-60' : undefined}>
          <SettingsToggleRow
            label={
              deepFocusLocked
                ? `${s.deepFocusEnabled}${strings.access.lockedSuffix}`
                : s.deepFocusEnabled
            }
            hint={s.deepFocusEnabledHint}
            checked={deepFocusLocked ? false : settings.deepFocusEnabled}
            onToggle={() => {
              if (!requireAccount('deepFocus')) return
              onChange({ ...settings, deepFocusEnabled: !settings.deepFocusEnabled })
            }}
          />
          {deepFocusLocked ? <LockedBadge className="right-1 top-1" /> : null}
        </div>
        {settings.deepFocusEnabled && !deepFocusLocked ? (
          <NumericStepper
            label={s.deepFocusGraceSeconds}
            value={settings.deepFocusGraceSeconds}
            min={DEEP_FOCUS_GRACE_SECONDS_RANGE.min}
            max={DEEP_FOCUS_GRACE_SECONDS_RANGE.max}
            step={DEEP_FOCUS_GRACE_SECONDS_RANGE.step}
            unit="s"
            onChange={(deepFocusGraceSeconds) => onChange({ ...settings, deepFocusGraceSeconds })}
          />
        ) : null}
      </div>

      <SettingsToggleRow
        label={s.guardAnnouncement}
        hint={s.guardAnnouncementHint}
        checked={settings.showGuardAnnouncement}
        onToggle={() =>
          onChange({ ...settings, showGuardAnnouncement: !settings.showGuardAnnouncement })
        }
      />

      <SessionGoalSettings settings={settings} onChange={onChange} />

      <CycleEndSettings settings={settings} onChange={onChange} />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--panel-muted)]">{s.sessionEndTitle}</p>

        <SettingsToggleRow
          label={s.confettiEnabled}
          hint={s.confettiEnabledHint}
          checked={settings.confettiEnabled}
          onToggle={() => onChange({ ...settings, confettiEnabled: !settings.confettiEnabled })}
        />

        <SettingsToggleRow
          label={s.sessionSummaryEnabled}
          hint={s.sessionSummaryEnabledHint}
          checked={settings.sessionSummaryEnabled}
          onToggle={() =>
            onChange({ ...settings, sessionSummaryEnabled: !settings.sessionSummaryEnabled })
          }
        />
      </div>

      <AlertSoundSettings settings={settings} onChange={onChange} />

      <KeyboardShortcutsHelp
        open={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
  )
}
