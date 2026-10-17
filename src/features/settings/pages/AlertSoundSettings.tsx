import { Play } from 'lucide-react'

import { ALERT_SOUNDS, playAlertSound } from '@/features/timer/alert-sounds'
import type { TimerSettings } from '@/features/timer/timer-settings'
import { SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

interface AlertSoundSettingsProps {
  settings: TimerSettings
  onChange: (settings: TimerSettings) => void
}

export function AlertSoundSettings({ settings, onChange }: AlertSoundSettingsProps) {
  const s = strings.settings.timer

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-sm font-medium text-[var(--panel-muted)]">{s.alertsTitle}</p>

      <SettingsToggleRow
        label={s.soundEnabled}
        hint={s.soundEnabledHint}
        checked={settings.soundEnabled}
        onToggle={() => onChange({ ...settings, soundEnabled: !settings.soundEnabled })}
      />
      <SettingsToggleRow
        label={s.notificationsEnabled}
        hint={s.notificationsEnabledHint}
        checked={settings.notificationsEnabled}
        onToggle={() =>
          onChange({ ...settings, notificationsEnabled: !settings.notificationsEnabled })
        }
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <span className="text-xs text-[var(--panel-muted)]">{s.alertSound}</span>
        <div className="flex flex-col gap-1.5">
          {ALERT_SOUNDS.map((sound) => (
            <div key={sound.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...settings, alertSoundId: sound.id })}
                aria-pressed={settings.alertSoundId === sound.id}
                className={`h-10 flex-1 rounded-xl border px-4 text-left text-sm transition-colors duration-200 ${
                  settings.alertSoundId === sound.id
                    ? 'border-[var(--accent)] bg-[var(--panel-surface)] text-[var(--panel-text)]'
                    : 'border-transparent text-[var(--panel-muted)] hover:bg-[var(--panel-surface)]'
                }`}
              >
                {s.alertSounds[sound.id as keyof typeof s.alertSounds] ?? sound.label}
              </button>
              <button
                type="button"
                onClick={() => playAlertSound(sound.id, settings.alertVolume)}
                aria-label={`${s.preview} : ${sound.label}`}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)]"
              >
                <Play size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-[var(--panel-muted)]">{s.volume}</span>
          <span className="text-xs text-[var(--panel-muted)]">
            {Math.round(settings.alertVolume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(settings.alertVolume * 100)}
          onChange={(event) =>
            onChange({ ...settings, alertVolume: Number(event.target.value) / 100 })
          }
          aria-label={s.volume}
        />
      </div>
    </div>
  )
}
