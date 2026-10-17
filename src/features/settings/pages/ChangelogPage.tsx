import { CHANGELOG } from '@/features/settings/changelog'
import { strings } from '@/shared/i18n'

export function ChangelogPage() {
  const s = strings.settings.changelog

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      {CHANGELOG.length === 0 ? (
        <p className="text-sm text-[var(--panel-muted)]">{s.empty}</p>
      ) : (
        <ul className="flex max-w-md flex-col gap-3">
          {CHANGELOG.map((entry) => (
            <li
              key={entry.version}
              className="flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--panel-text)]">
                  {entry.version}
                </span>
                <span className="text-xs text-[var(--panel-muted)]">{entry.date}</span>
              </div>
              <p className="text-sm text-[var(--panel-text)]">{entry.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
