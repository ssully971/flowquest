import { Target, Trophy } from 'lucide-react'
import { useState } from 'react'

import { formatFocusDuration } from '@/features/stats/format'
import type { PillarRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

import { goalPace, goalProgressRatio } from '../pillar-xp'

interface PillarGoalProps {
  pillar: PillarRecord
  onSetGoal: (level: number, deadlineMs: number | null) => void
  onClearGoal: () => void
}

function toDateInputValue(ms: number | null): string {
  if (ms === null) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

function fromDateInputValue(value: string): number | null {
  if (!value) return null
  const parsed = new Date(`${value}T23:59:59`).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Objectif de niveau par pilier (lot 4, §4) : un niveau visé, une date limite
 * optionnelle. Affiche la progression (XP restante, barre) et, si une date est fixée, le
 * temps de focus moyen par jour nécessaire pour l'atteindre à temps (goalPace, pure et
 * testée séparément dans pillar-xp.test.ts). La notification à l'atteinte de l'objectif
 * est ailleurs (SessionEndScreen) : ce composant affiche l'état courant, jamais
 * l'évènement ponctuel de l'avoir atteint.
 */
export function PillarGoal({ pillar, onSetGoal, onClearGoal }: PillarGoalProps) {
  const s = strings.settings.pillars.goal
  const [isEditing, setIsEditing] = useState(false)
  const [draftLevel, setDraftLevel] = useState(() => String(pillar.goalLevel ?? pillar.level + 1))
  const [draftDeadline, setDraftDeadline] = useState(() => toDateInputValue(pillar.goalDeadline))
  const [error, setError] = useState<string | null>(null)
  // Date.now() n'est jamais lu directement pendant le rendu (impur, voir la règle
  // react-hooks/purity) : capturée une seule fois via l'initialiseur paresseux de
  // useState, bien assez précis pour un calcul au jour près (jours restants avant la
  // date limite) — pas besoin qu'elle avance pendant que le composant reste monté.
  const [now] = useState(() => Date.now())

  const startEditing = () => {
    setDraftLevel(String(pillar.goalLevel ?? pillar.level + 1))
    setDraftDeadline(toDateInputValue(pillar.goalDeadline))
    setError(null)
    setIsEditing(true)
  }

  const commit = () => {
    const level = Number.parseInt(draftLevel, 10)
    if (!Number.isFinite(level) || level <= pillar.level) {
      setError(s.invalidLevel)
      return
    }
    onSetGoal(level, fromDateInputValue(draftDeadline))
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 pl-9">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--panel-muted)]">
            {s.levelLabel}
            <input
              type="number"
              inputMode="numeric"
              min={pillar.level + 1}
              value={draftLevel}
              onChange={(event) => setDraftLevel(event.target.value)}
              className="h-8 w-16 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-sm text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--panel-muted)]">
            {s.deadlineLabel}
            <input
              type="date"
              value={draftDeadline}
              onChange={(event) => setDraftDeadline(event.target.value)}
              className="h-8 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-sm text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-[#E5484D]">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={commit}
            className="h-8 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--on-accent)]"
          >
            {s.save}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="h-8 rounded-lg border border-[var(--panel-line)] px-3 text-xs text-[var(--panel-text)]"
          >
            {s.cancel}
          </button>
        </div>
      </div>
    )
  }

  if (pillar.goalLevel === null) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="ml-9 flex w-fit items-center gap-1.5 text-xs text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)]"
      >
        <Target size={13} strokeWidth={1.75} aria-hidden="true" />
        {s.setLabel}
      </button>
    )
  }

  const goalLevel = pillar.goalLevel
  const reached = pillar.level >= goalLevel
  const progress = goalProgressRatio(pillar.currentXp, goalLevel)
  const pace = goalPace(pillar.currentXp, goalLevel, pillar.goalDeadline, now)
  const deadlinePassed = !reached && pace.daysUntilDeadline !== null && pace.daysUntilDeadline <= 0

  return (
    <div className="flex flex-col gap-1.5 pl-9">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-[var(--panel-muted)]">
          {reached ? <Trophy size={13} strokeWidth={1.75} aria-hidden="true" /> : null}
          {s.summaryPrefix} {goalLevel}
          {reached ? ` · ${s.reached}` : null}
        </span>
        <span className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={startEditing}
            className="text-[var(--panel-muted)] underline-offset-2 hover:text-[var(--panel-text)] hover:underline"
          >
            {s.editLabel}
          </button>
          <button
            type="button"
            onClick={onClearGoal}
            className="text-[var(--panel-muted)] underline-offset-2 hover:text-[var(--panel-text)] hover:underline"
          >
            {s.clearLabel}
          </button>
        </span>
      </div>

      {!reached ? (
        <>
          <div className="h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--panel-line)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--panel-muted)]">
            {s.remainingPrefix} {formatFocusDuration(pace.secondsRemaining)} {s.remainingSuffix}
            {pace.averageSecondsPerDayNeeded !== null
              ? ` · ${formatFocusDuration(pace.averageSecondsPerDayNeeded)}${s.paceSuffix}`
              : null}
            {deadlinePassed ? ` · ${s.deadlinePassed}` : null}
          </p>
        </>
      ) : null}
    </div>
  )
}
