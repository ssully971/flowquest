import { pickDailyQuote } from '@/features/home/quotes'
import type { QuoteCategory } from '@/features/home/quotes'
import type { QuotesSettings } from '@/features/home/quotes-settings'
import { SegmentedControl, SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

interface QuotesPageProps {
  settings: QuotesSettings
  onChange: (settings: QuotesSettings) => void
}

export function QuotesPage({ settings, onChange }: QuotesPageProps) {
  const s = strings.settings.quotes
  const preview = pickDailyQuote(settings.category)

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.preview}</p>
        <figure className="max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
          <blockquote className="text-sm text-[var(--panel-text)]">“{preview.text}”</blockquote>
          <figcaption className="mt-1 text-xs text-[var(--panel-muted)]">
            {preview.author}
          </figcaption>
        </figure>
      </div>

      <SettingsToggleRow
        label={s.showOnHome}
        checked={settings.showOnHome}
        onToggle={() => onChange({ ...settings, showOnHome: !settings.showOnHome })}
      />
      <SettingsToggleRow
        label={s.showOnFocus}
        checked={settings.showOnFocus}
        onToggle={() => onChange({ ...settings, showOnFocus: !settings.showOnFocus })}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.rotation}</p>
        <SegmentedControl<QuotesSettings['rotation']>
          ariaLabel={s.rotation}
          value={settings.rotation}
          onChange={(rotation) => onChange({ ...settings, rotation })}
          options={[
            { value: 'daily', label: s.rotationDaily },
            { value: 'everyLoad', label: s.rotationEveryLoad },
          ]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.category}</p>
        <SegmentedControl<QuoteCategory | 'all'>
          ariaLabel={s.category}
          value={settings.category}
          onChange={(category) => onChange({ ...settings, category })}
          options={[
            { value: 'all', label: s.categoryAll },
            { value: 'medicine', label: s.categoryMedicine },
            { value: 'focus', label: s.categoryFocus },
          ]}
        />
      </div>
    </div>
  )
}
