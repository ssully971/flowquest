import type { ExtrasSettings, SettingsPanelSide } from '@/features/settings/extras-settings'
import { SETTINGS_PAGE_IDS } from '@/features/settings/page-id'
import { SegmentedControl, SettingsToggleRow } from '@/shared/design-system'
import { useWakeLock } from '@/shared/hooks/useWakeLock'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'

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

      <SettingsToggleRow
        label={s.disableAnimatedThemes}
        hint={s.disableAnimatedThemesHint}
        checked={settings.disableAnimatedThemes}
        onToggle={() =>
          onChange({ ...settings, disableAnimatedThemes: !settings.disableAnimatedThemes })
        }
      />

      <SettingsToggleRow
        label={s.cleanMode}
        hint={s.cleanModeHint}
        checked={settings.cleanMode}
        onToggle={() => onChange({ ...settings, cleanMode: !settings.cleanMode })}
      />

      <SettingsToggleRow
        label={s.preventSleep}
        hint={wakeLock.isSupported ? s.preventSleepHint : s.preventSleepUnsupported}
        checked={settings.preventSleep}
        onToggle={() => onChange({ ...settings, preventSleep: !settings.preventSleep })}
      />

      <SettingsToggleRow
        label={s.themeRandomizer}
        hint={s.themeRandomizerHint}
        checked={settings.themeRandomizer}
        onToggle={() => onChange({ ...settings, themeRandomizer: !settings.themeRandomizer })}
      />

      <SettingsToggleRow
        label={s.showStreak}
        hint={s.showStreakHint}
        checked={settings.showStreak}
        onToggle={() => onChange({ ...settings, showStreak: !settings.showStreak })}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.settingsPanelSide}</p>
        <SegmentedControl<SettingsPanelSide>
          ariaLabel={s.settingsPanelSide}
          value={settings.settingsPanelSide}
          onChange={(settingsPanelSide) => onChange({ ...settings, settingsPanelSide })}
          options={[
            { value: 'left', label: s.settingsPanelSideLeft },
            { value: 'right', label: s.settingsPanelSideRight },
          ]}
        />
        <p className="mt-2 text-xs text-[var(--panel-muted)]">{s.settingsPanelSideHint}</p>
      </div>

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
