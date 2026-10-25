import { Coffee, Moon, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent, TouchEvent } from 'react'

import { strings } from '@/shared/i18n'

import type { SegmentKind } from '../engine/timer-engine'

interface SegmentTabsProps {
  value: SegmentKind
  onChange: (segment: SegmentKind) => void
  /** Bloque le changement d'onglet (LOT E5) : une session de focus ou de pause tourne ou
   * est en pause, et ne doit jamais se terminer implicitement en cliquant sur un autre
   * onglet. L'utilisateur doit d'abord l'arrêter explicitement (bouton Terminer). */
  disabled?: boolean
}

// Icônes plutôt que libellés texte (LOT H2, §3) : le nom n'apparaît sous l'icône que pour
// le mode actif, ou au survol/appui prolongé (voir `revealedTab` ci-dessous) — l'écran
// reste épuré (icône cible = Focus, tasse = pause courte, lune = pause longue).
const TABS: { value: SegmentKind; label: string; icon: LucideIcon }[] = [
  { value: 'focus', label: strings.focus.tabs.focus, icon: Target },
  { value: 'short_break', label: strings.focus.tabs.shortBreak, icon: Coffee },
  { value: 'long_break', label: strings.focus.tabs.longBreak, icon: Moon },
]

const LONG_PRESS_MS = 500

export function SegmentTabs({ value, onChange, disabled = false }: SegmentTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [revealedTab, setRevealedTab] = useState<SegmentKind | null>(null)
  const longPressTimerRef = useRef<number | null>(null)

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
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

  const handleTouchStart = (tab: SegmentKind) => (event: TouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) return
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => setRevealedTab(tab), LONG_PRESS_MS)
  }
  const handleTouchEnd = (tab: SegmentKind) => () => {
    clearLongPressTimer()
    setRevealedTab((prev) => (prev === tab ? null : prev))
  }

  return (
    <div ref={containerRef} role="tablist" aria-label={strings.focus.question} className="flex items-center gap-5">
      {TABS.map((tab) => {
        const selected = tab.value === value
        const showLabel = selected || revealedTab === tab.value
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={disabled}
            aria-label={tab.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (disabled) return
              onChange(tab.value)
            }}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setRevealedTab(tab.value)}
            onMouseLeave={() => setRevealedTab((prev) => (prev === tab.value ? null : prev))}
            onFocus={() => setRevealedTab(tab.value)}
            onBlur={() => setRevealedTab((prev) => (prev === tab.value ? null : prev))}
            onTouchStart={handleTouchStart(tab.value)}
            onTouchEnd={handleTouchEnd(tab.value)}
            onTouchCancel={handleTouchEnd(tab.value)}
            className={`flex flex-col items-center gap-1.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-200 ${
                selected
                  ? 'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--text)]'
                  : 'border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span
              aria-hidden="true"
              className={`text-xs font-medium transition-opacity duration-200 ${
                showLabel ? 'opacity-100' : 'opacity-0'
              } ${selected ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
