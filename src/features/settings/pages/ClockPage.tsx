import { CLOCK_SIZE_SCALE, CLOCK_STYLES, CLOCK_STYLE_CSS } from '@/features/home/clock-settings'
import type { ClockFormat, ClockSettings, ClockSize } from '@/features/home/clock-settings'
import { BigDigits, SegmentedControl, SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'

interface ClockPageProps {
  settings: ClockSettings
  onChange: (settings: ClockSettings) => void
}

export function ClockPage({ settings, onChange }: ClockPageProps) {
  const s = strings.settings.clock
  const styleCss = CLOCK_STYLE_CSS[settings.style]

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.format}</p>
        <SegmentedControl<ClockFormat>
          ariaLabel={s.format}
          value={settings.format}
          onChange={(format) => onChange({ ...settings, format })}
          options={[
            { value: '24h', label: s.format24h },
            { value: '12h', label: s.format12h },
          ]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.size}</p>
        <SegmentedControl<ClockSize>
          ariaLabel={s.size}
          value={settings.size}
          onChange={(size) => onChange({ ...settings, size })}
          options={[
            { value: 'small', label: s.sizeSmall },
            { value: 'normal', label: s.sizeNormal },
            { value: 'huge', label: s.sizeHuge },
          ]}
        />
        <p className="mt-2 text-xs text-[var(--panel-muted)]">{s.sizeHint}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.style}</p>
        <div
          className="mb-4 flex h-32 w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--panel-line)' }}
        >
          <BigDigits
            label="09:41"
            sizePx={56}
            sizeScale={CLOCK_SIZE_SCALE[settings.size]}
            fontFamily={styleCss.fontFamily}
            fontWeight={styleCss.fontWeight}
            letterSpacing={styleCss.letterSpacing}
            fontStyle={styleCss.fontStyle}
            flip={settings.flipClock}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CLOCK_STYLES.map((style) => (
            <CategoryChip
              key={style}
              label={s.styles[style]}
              active={style === settings.style}
              onClick={() => onChange({ ...settings, style })}
            />
          ))}
        </div>
      </div>

      <SettingsToggleRow
        label={s.showSeconds}
        checked={settings.showSeconds}
        onToggle={() => onChange({ ...settings, showSeconds: !settings.showSeconds })}
      />
      <SettingsToggleRow
        label={s.showGreeting}
        checked={settings.showGreeting}
        onToggle={() => onChange({ ...settings, showGreeting: !settings.showGreeting })}
      />
      <SettingsToggleRow
        label={s.flipClock}
        hint={s.flipClockHint}
        checked={settings.flipClock}
        onToggle={() => onChange({ ...settings, flipClock: !settings.flipClock })}
      />
    </div>
  )
}
