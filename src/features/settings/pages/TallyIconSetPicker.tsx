import { SessionTally } from '@/features/timer/components/SessionTally'
import { TALLY_ICON_SETS } from '@/features/timer/tally-icon-set'
import type { TallyIconSet } from '@/features/timer/tally-icon-set'
import { strings } from '@/shared/i18n'

const PREVIEW_TOTAL = 4
const PREVIEW_COMPLETED = 2

interface TallyIconSetPickerProps {
  value: TallyIconSet
  onChange: (iconSet: TallyIconSet) => void
}

export function TallyIconSetPicker({ value, onChange }: TallyIconSetPickerProps) {
  const s = strings.settings.timer

  return (
    <div className="grid max-w-md grid-cols-2 gap-3">
      {TALLY_ICON_SETS.map((iconSet) => (
        <button
          key={iconSet}
          type="button"
          onClick={() => onChange(iconSet)}
          aria-pressed={value === iconSet}
          className={`flex h-20 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border p-3 transition-colors duration-200 ${
            value === iconSet
              ? 'border-[var(--accent)] bg-[var(--panel-surface-2)]'
              : 'border-[var(--panel-line)] hover:bg-[var(--panel-surface-2)]'
          }`}
        >
          <div aria-hidden="true" className="flex items-center justify-center">
            <SessionTally
              total={PREVIEW_TOTAL}
              completed={PREVIEW_COMPLETED}
              currentIsFocus
              iconSet={iconSet}
            />
          </div>
          <span className="text-xs text-[var(--panel-text)]">{s.tallyIconSets[iconSet]}</span>
        </button>
      ))}
    </div>
  )
}
