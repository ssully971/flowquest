import { Target, Trophy } from 'lucide-react'
import { useState } from 'react'

import { formatFocusDuration } from '@/features/stats/format'
import type { PillarRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

import { tierForLevel } from '../pillar-tiers'
import {
  goalPace,
  goalProgressRatio,
  hoursToReachLevel,
  levelAfterAddingHours,
  wholeHoursForGoal,
  XP_PER_HOUR,
} from '../pillar-xp'

interface PillarGoalProps {
  pillar: PillarRecord
  onSetGoal: (level: number, deadlineMs: number | null) => void
  onClearGoal: () => void
}

/** « 12 h », « 7,5 h » : heures cumulées, une décimale au plus. */
function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`.replace('.', ',')
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
  const initialLevel = pillar.goalLevel ?? pillar.level + 1
  const [draftLevel, setDraftLevel] = useState(() => String(initialLevel))
  // Les deux champs sont liés : l'heure saisie donne le niveau atteint, le niveau visé donne
  // les heures nécessaires (la dernière saisie fait foi, l'autre se recalcule).
  const [draftHours, setDraftHours] = useState(() =>
    String(wholeHoursForGoal(pillar.currentXp, initialLevel)),
  )
  const [draftDeadline, setDraftDeadline] = useState(() => toDateInputValue(pillar.goalDeadline))
  const [error, setError] = useState<string | null>(null)
  // Date.now() n'est jamais lu directement pendant le rendu (impur, voir la règle
  // react-hooks/purity) : capturée une seule fois via l'initialiseur paresseux de
  // useState, bien assez précis pour un calcul au jour près (jours restants avant la
  // date limite) — pas besoin qu'elle avance pendant que le composant reste monté.
  const [now] = useState(() => Date.now())

  const startEditing = () => {
    const level = pillar.goalLevel ?? pillar.level + 1
    setDraftLevel(String(level))
    setDraftHours(String(wholeHoursForGoal(pillar.currentXp, level)))
    setDraftDeadline(toDateInputValue(pillar.goalDeadline))
    setError(null)
    setIsEditing(true)
  }

  const onHoursChange = (value: string) => {
    setDraftHours(value)
    const hours = Number.parseFloat(value)
    if (!Number.isFinite(hours) || hours < 0) return
    setDraftLevel(String(levelAfterAddingHours(pillar.currentXp, hours)))
  }

  const onLevelChange = (value: string) => {
    setDraftLevel(value)
    const level = Number.parseInt(value, 10)
    if (!Number.isFinite(level) || level < 1) return
    setDraftHours(String(wholeHoursForGoal(pillar.currentXp, level)))
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

  const parsedDraftLevel = Number.parseInt(draftLevel, 10)
  const previewLevel = Number.isFinite(parsedDraftLevel) ? parsedDraftLevel : null

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 pl-9">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-full flex-col gap-1 text-xs text-[var(--panel-muted)]">
            {s.hoursQuestion}
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                aria-label={s.hoursLabel}
                value={draftHours}
                onChange={(event) => onHoursChange(event.target.value)}
                className="h-11 w-20 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-sm text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
              />
              {s.hoursUnit}
            </span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--panel-muted)]">
            {s.levelLabel}
            <input
              type="number"
              inputMode="numeric"
              min={pillar.level + 1}
              value={draftLevel}
              onChange={(event) => onLevelChange(event.target.value)}
              className="h-11 w-16 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-sm text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
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
        {previewLevel !== null ? (
          <p className="text-xs text-[var(--panel-muted)]">
            {previewLevel > pillar.level
              ? s.reachesLevel(previewLevel, strings.pillars.tiers[tierForLevel(previewLevel).id])
              : s.belowNextLevel}
          </p>
        ) : null}
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
          <div
            role="progressbar"
            aria-label={s.progressHoursLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--panel-line)]"
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--panel-muted)]">
            {s.progressHours(
              formatHours(pillar.currentXp / XP_PER_HOUR),
              formatHours(hoursToReachLevel(goalLevel)),
            )}{' '}
            · {s.levelShort} {pillar.level} → {goalLevel}
          </p>
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
