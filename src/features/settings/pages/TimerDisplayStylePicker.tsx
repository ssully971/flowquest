import { TimerFace } from '@/features/timer/components/TimerFace'
import { TIMER_DISPLAY_STYLES } from '@/features/timer/timer-display-style'
import type { TimerDisplayStyle } from '@/features/timer/timer-display-style'
import { strings } from '@/shared/i18n'

const PREVIEW_LABEL = '12:34'
const PREVIEW_PROGRESS = 0.62

interface TimerDisplayStylePickerProps {
  value: TimerDisplayStyle
  onChange: (style: TimerDisplayStyle) => void
}

export function TimerDisplayStylePicker({ value, onChange }: TimerDisplayStylePickerProps) {
  const s = strings.settings.timer

  return (
    <div className="grid max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
      {TIMER_DISPLAY_STYLES.map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => onChange(style)}
          aria-pressed={value === style}
          className={`flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-colors duration-200 ${
            value === style
              ? 'border-[var(--accent)] bg-[var(--panel-surface-2)]'
              : 'border-[var(--panel-line)] hover:bg-[var(--panel-surface-2)]'
          }`}
        >
          <div className="flex h-14 items-center justify-center" aria-hidden="true">
            <TimerFace style={style} label={PREVIEW_LABEL} progress={PREVIEW_PROGRESS} compact />
          </div>
          <span className="text-xs text-[var(--panel-text)]">{s.displayStyles[style]}</span>
        </button>
      ))}
    </div>
  )
}
