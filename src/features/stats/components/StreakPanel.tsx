import { Check, Flame, Info, Snowflake, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { strings } from '@/shared/i18n'

import {
  getNextStreakMilestone,
  getPreviousStreakMilestone,
  getWeekDayState,
} from '../compute-stats'
import type { DashboardStats, WeekDayState } from '../compute-stats'
import { FREEZE_EARN_SECONDS, FREEZE_STOCK_CAP } from '../streak-freezes'
import { useDailyFocusHistory } from '../useDailyFocusHistory'

interface StreakPanelProps {
  open: boolean
  onClose: () => void
  stats: DashboardStats | null
}

const WEEKDAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const HISTORY_LIMIT = 5

const DAY_CLASSES: Record<WeekDayState, string> = {
  validated: 'bg-[var(--streak-flame)] text-[var(--panel-surface)]',
  frozen: 'bg-[var(--streak-ice-soft)] text-[var(--streak-ice)] ring-1 ring-[var(--streak-ice)]',
  missed: 'bg-[var(--panel-surface-2)] text-[var(--panel-muted)]',
  today: 'bg-transparent text-[var(--panel-text)] ring-2 ring-[var(--streak-flame)]',
}

/** « 3 h 20 », « 10 h », « 40 min » — pour la progression « 3 h 20 / 10 h ». */
function formatHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}

export function StreakPanel({ open, onClose, stats }: StreakPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const week = useDailyFocusHistory(7, stats?.dailyGoalMinutes)
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const s = strings.streak
  const f = s.freezes
  const currentStreakDays = stats?.currentStreakDays ?? 0
  const longestStreakDays = stats?.longestStreakDays ?? 0
  const freezes = stats?.freezes
  const frozenDays = new Set(freezes?.usedDays ?? [])
  const nextMilestone = getNextStreakMilestone(currentStreakDays)
  const daysToMilestone = nextMilestone - currentStreakDays
  const hasHistory = currentStreakDays > 0 || longestStreakDays > 0 || frozenDays.size > 0
  // La fenêtre de 7 jours se termine aujourd'hui (pas de Date.now() pendant le rendu).
  const todayStart = week?.[week.length - 1]?.dayStart ?? 0
  const previousMilestone = getPreviousStreakMilestone(nextMilestone)
  const milestoneRatio = Math.min(
    1,
    (currentStreakDays - previousMilestone) / Math.max(1, nextMilestone - previousMilestone),
  )
  const recentUses = [...(freezes?.usedDays ?? [])].sort((a, b) => b - a).slice(0, HISTORY_LIMIT)

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={s.title}
      className="absolute bottom-full left-0 z-40 mb-3 flex max-h-[min(34rem,calc(100dvh-8rem))] w-[min(21rem,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-4 text-[var(--panel-text)] shadow-[0_12px_32px_rgba(20,12,40,0.22)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{s.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={s.close}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--streak-flame)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {!hasHistory ? (
        <p className="text-sm text-[var(--panel-muted)]">{s.empty}</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span className="streak-flame flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--streak-flame-soft)] text-[var(--streak-flame)]">
              <Flame size={28} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-4xl font-bold leading-none tabular-nums">
                {currentStreakDays}
              </span>
              <span className="mt-1 text-xs text-[var(--panel-muted)]">{s.current}</span>
            </div>
            <div className="ml-auto flex flex-col items-end">
              <span className="text-xl font-semibold tabular-nums">{longestStreakDays}</span>
              <span className="text-xs text-[var(--panel-muted)]">{s.record}</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-[var(--panel-muted)]">{s.thisWeek}</p>
            <ul className="flex justify-between gap-1">
              {(week ?? []).map((day) => {
                const date = new Date(day.dayStart)
                const state = getWeekDayState(day, todayStart, frozenDays)
                return (
                  <li
                    key={day.dayStart}
                    aria-label={`${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} : ${s.dayStates[state]}`}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="text-[0.6875rem] text-[var(--panel-muted)]" aria-hidden="true">
                      {s.weekdayLetters[date.getDay()]}
                    </span>
                    <span
                      title={date.toLocaleDateString('fr-FR')}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs ${DAY_CLASSES[state]}`}
                    >
                      {state === 'validated' ? (
                        <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                      ) : state === 'frozen' ? (
                        <Snowflake size={15} strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">{date.getDate()}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <div
              role="progressbar"
              aria-label={s.milestoneProgressLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(milestoneRatio * 100)}
              className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-surface-2)]"
            >
              <div
                className="h-full rounded-full bg-[var(--streak-flame)] transition-[width] duration-500"
                style={{ width: `${milestoneRatio * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--panel-muted)]">
              {s.nextMilestone} : {nextMilestone} {nextMilestone === 1 ? s.day : s.days}
              {daysToMilestone > 0
                ? ` (${s.nextMilestoneIn} ${daysToMilestone} ${daysToMilestone === 1 ? s.day : s.days})`
                : ''}
            </p>
          </div>
        </>
      )}

      {freezes ? (
        <section
          aria-label={f.title}
          className="flex flex-col gap-3 border-t border-[var(--panel-line)] pt-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <button
              type="button"
              onClick={() => setInfoOpen((prev) => !prev)}
              aria-expanded={infoOpen}
              aria-label={infoOpen ? f.infoClose : f.info}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--streak-ice)]"
            >
              <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          {infoOpen ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-[var(--panel-muted)]">
              {f.infoText.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          <div
            className="flex items-center gap-2"
            role="img"
            aria-label={f.stockLabel(freezes.stock, FREEZE_STOCK_CAP)}
          >
            {Array.from({ length: FREEZE_STOCK_CAP }, (_, index) => (
              <span
                key={index}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  index < freezes.stock
                    ? 'bg-[var(--streak-ice-soft)] text-[var(--streak-ice)] ring-1 ring-[var(--streak-ice)]'
                    : 'bg-[var(--panel-surface-2)] text-[var(--panel-muted)] opacity-60'
                }`}
              >
                <Snowflake size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
            ))}
            <span className="ml-1 text-xs text-[var(--panel-muted)]">
              {f.stockLabel(freezes.stock, FREEZE_STOCK_CAP)}
            </span>
          </div>

          <div>
            <div
              role="progressbar"
              aria-label={f.progressLabel}
              aria-valuemin={0}
              aria-valuemax={FREEZE_EARN_SECONDS}
              aria-valuenow={Math.round(freezes.progressSeconds)}
              className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-surface-2)]"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${freezes.capped ? 'bg-[var(--panel-muted)]' : 'bg-[var(--streak-ice)]'}`}
                style={{ width: `${(freezes.progressSeconds / FREEZE_EARN_SECONDS) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--panel-muted)]">
              {f.progressValue(
                formatHours(freezes.progressSeconds),
                formatHours(FREEZE_EARN_SECONDS),
              )}
            </p>
            {freezes.capped ? (
              <p className="mt-1 text-xs text-[var(--panel-text)]">{f.cappedMessage}</p>
            ) : null}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">{f.historyTitle}</p>
            {recentUses.length === 0 ? (
              <p className="text-xs text-[var(--panel-muted)]">{f.historyEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-xs text-[var(--panel-muted)]">
                {recentUses.map((day) => (
                  <li key={day} className="flex items-center gap-1.5">
                    <Snowflake
                      size={12}
                      strokeWidth={1.75}
                      className="text-[var(--streak-ice)]"
                      aria-hidden="true"
                    />
                    {new Date(day).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
