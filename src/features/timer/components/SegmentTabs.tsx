import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

import { strings } from '@/shared/i18n'

import type { SegmentKind } from '../engine/timer-engine'

interface SegmentTabsProps {
  value: SegmentKind
  onChange: (segment: SegmentKind) => void
}

const TABS: { value: SegmentKind; label: string }[] = [
  { value: 'focus', label: strings.focus.tabs.focus },
  { value: 'short_break', label: strings.focus.tabs.shortBreak },
  { value: 'long_break', label: strings.focus.tabs.longBreak },
]

export function SegmentTabs({ value, onChange }: SegmentTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.value === value)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % TABS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1
    }
    if (nextIndex === null) return

    event.preventDefault()
    onChange(TABS[nextIndex].value)
    containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={strings.focus.question}
      className="flex items-center gap-6"
    >
      {TABS.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={handleKeyDown}
            className={`relative pb-2 text-sm font-medium transition-colors duration-200 ${
              selected ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
            {selected ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
