import type { LucideIcon } from 'lucide-react'
import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = options.findIndex((option) => option.value === value)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    }
    if (nextIndex === null) return

    event.preventDefault()
    onChange(options[nextIndex].value)
    containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
              selected
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {Icon ? <Icon size={18} strokeWidth={1.75} aria-hidden="true" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
