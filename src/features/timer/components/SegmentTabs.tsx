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
  return (
    <div role="tablist" aria-label={strings.focus.question} className="flex items-center gap-6">
      {TABS.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
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
