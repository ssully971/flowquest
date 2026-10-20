import type { LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
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

interface IndicatorRect {
  left: number
  width: number
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null)

  // Indicateur unique qui glisse vers le segment choisi (LOT D), plutôt qu'un fond
  // basculé indépendamment sur chaque bouton : mesure la position réelle du bouton
  // sélectionné (les segments n'ont pas tous la même largeur) et la reproduit sur un
  // calque commun, animé en CSS. jsdom ne mesure jamais de vraie mise en page
  // (getBoundingClientRect y renvoie des zéros) : seul un navigateur réel peut confirmer
  // visuellement le glissement, voir SegmentedControl.test.tsx.
  useLayoutEffect(() => {
    const container = containerRef.current
    const button = buttonRefs.current.get(value)
    if (!container || !button) return
    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    setIndicator({ left: buttonRect.left - containerRect.left, width: buttonRect.width })
  }, [value, options])

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
      className="relative inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1.5"
    >
      {indicator ? (
        <div
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 rounded-full bg-[var(--accent)] transition-[left,width] duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el)
              else buttonRefs.current.delete(option.value)
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={`relative z-10 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
              selected ? 'text-[var(--on-accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
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
