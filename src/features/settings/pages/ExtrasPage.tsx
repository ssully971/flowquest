import type { ExtrasSettings } from '@/features/settings/extras-settings'
import { SETTINGS_PAGE_IDS } from '@/features/settings/page-id'
import { useWakeLock } from '@/shared/hooks/useWakeLock'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'

interface ToggleRowProps {
  label: string
  hint?: string
  checked: boolean
  onToggle: () => void
}

function ToggleRow({ label, hint, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--panel-text)]">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={onToggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
            checked ? 'bg-[var(--accent)]' : 'bg-[var(--panel-line)]'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {hint ? <p className="text-xs text-[var(--panel-muted)]">{hint}</p> : null}
    </div>
  )
}

interface ExtrasPageProps {
  settings: ExtrasSettings
  onChange: (settings: ExtrasSettings) => void
}

export function ExtrasPage({ settings, onChange }: ExtrasPageProps) {
  const s = strings.settings.extras
  const wakeLock = useWakeLock(false)

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.displayName}</p>
        <input
          type="text"
          value={settings.displayName}
          onChange={(event) => onChange({ ...settings, displayName: event.target.value })}
          placeholder={s.displayNamePlaceholder}
          maxLength={40}
          className="h-11 w-full max-w-xs rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
        />
      </div>

      <ToggleRow
        label={s.disableAnimatedThemes}
        hint={s.disableAnimatedThemesHint}
        checked={settings.disableAnimatedThemes}
        onToggle={() =>
          onChange({ ...settings, disableAnimatedThemes: !settings.disableAnimatedThemes })
        }
      />

      <ToggleRow
        label={s.cleanMode}
        hint={s.cleanModeHint}
        checked={settings.cleanMode}
        onToggle={() => onChange({ ...settings, cleanMode: !settings.cleanMode })}
      />

      <ToggleRow
        label={s.preventSleep}
        hint={wakeLock.isSupported ? s.preventSleepHint : s.preventSleepUnsupported}
        checked={settings.preventSleep}
        onToggle={() => onChange({ ...settings, preventSleep: !settings.preventSleep })}
      />

      <ToggleRow
        label={s.themeRandomizer}
        hint={s.themeRandomizerHint}
        checked={settings.themeRandomizer}
        onToggle={() => onChange({ ...settings, themeRandomizer: !settings.themeRandomizer })}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.defaultSettingsTab}</p>
        <div className="flex flex-wrap gap-2">
          {SETTINGS_PAGE_IDS.map((pageId) => (
            <CategoryChip
              key={pageId}
              label={strings.settings.nav[pageId]}
              active={pageId === settings.defaultSettingsTab}
              onClick={() => onChange({ ...settings, defaultSettingsTab: pageId })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
