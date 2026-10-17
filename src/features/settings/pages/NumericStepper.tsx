import { Minus, Plus } from 'lucide-react'

import { strings } from '@/shared/i18n'

interface NumericStepperProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

export function NumericStepper({ label, value, min, max, step, unit, onChange }: NumericStepperProps) {
  const s = strings.settings.timer
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <span className="text-xs text-[var(--panel-muted)]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${s.decrease} : ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className="min-w-[4rem] text-center text-sm text-[var(--panel-text)]">
          {value} {unit}
        </span>
        <button
          type="button"
          aria-label={`${s.increase} : ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
