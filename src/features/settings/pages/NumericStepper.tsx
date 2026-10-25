import { Minus, Plus } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import { strings } from '@/shared/i18n'

import { useEditableNumber } from './useEditableNumber'

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
  const { draft, error, onDraftChange, onCommit } = useEditableNumber(value, min, max, onChange)

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    // LOT H1, §6 : auparavant empilé (libellé au-dessus d'une grande rangée −/valeur/+
    // sans largeur limite), ce qui le faisait paraître disproportionné par rapport aux
    // autres lignes du panneau (interrupteurs, `max-w-md` compris). Désormais une seule
    // ligne, même largeur et même hauteur que SettingsToggleRow — seul le bloc −/valeur/+
    // reste compact (≈96 px), harmonisé entre tous les champs numériques du panneau.
    <div className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--panel-text)]">{label}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`${s.decrease} : ${label}`}
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - step))}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className="flex items-center justify-center gap-1 text-sm text-[var(--panel-text)]">
            <input
              type="number"
              inputMode="numeric"
              aria-label={label}
              aria-invalid={error ? 'true' : undefined}
              min={min}
              max={max}
              step={step}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onBlur={onCommit}
              onKeyDown={handleKeyDown}
              className="w-8 rounded-lg border border-transparent bg-transparent text-center text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 [appearance:textfield] focus:border-[var(--panel-line)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {unit ? <span className="text-xs text-[var(--panel-muted)]">{unit}</span> : null}
          </span>
          <button
            type="button"
            aria-label={`${s.increase} : ${label}`}
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + step))}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[#E5484D]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
