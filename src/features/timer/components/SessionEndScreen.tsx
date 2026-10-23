import { PartyPopper } from 'lucide-react'

import { strings } from '@/shared/i18n'

import type { CycleSummary } from '../cycle-summary'
import { formatPlanDuration } from '../session-goal'

interface SessionEndScreenProps {
  summary: CycleSummary | null
  showSummary: boolean
  onAcknowledge: () => void
}

/**
 * Écran de fin de session (LOT E6) : le titre « Session terminée » est TOUJOURS affiché,
 * que les confettis et le bilan soient activés ou non (une fin de session ne doit jamais
 * passer inaperçue). Le détail chiffré n'apparaît que si le bilan est activé dans les
 * réglages ; les confettis (effet à part, voir session-end-confetti.ts) sont déclenchés
 * par l'appelant au moment où cet écran apparaît.
 */
export function SessionEndScreen({ summary, showSummary, onAcknowledge }: SessionEndScreenProps) {
  const s = strings.focus.sessionEnd

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-8 py-10 text-center"
    >
      <PartyPopper size={32} strokeWidth={1.75} className="text-[var(--accent)]" aria-hidden="true" />
      <p
        className="text-2xl font-bold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </p>

      {showSummary && summary ? (
        <dl className="mt-2 grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
          <dt className="text-[var(--muted)]">{s.focusDuration}</dt>
          <dd className="text-right font-medium text-[var(--text)]">
            {formatPlanDuration(summary.focusSeconds * 1000)}
          </dd>
          <dt className="text-[var(--muted)]">{s.sessionsCount}</dt>
          <dd className="text-right font-medium text-[var(--text)]">{summary.sessionsCount}</dd>
          <dt className="text-[var(--muted)]">{s.pausesCount}</dt>
          <dd className="text-right font-medium text-[var(--text)]">{summary.pausesCount}</dd>
          <dt className="text-[var(--muted)]">{s.tasksCompleted}</dt>
          <dd className="text-right font-medium text-[var(--text)]">{summary.completedTasksCount}</dd>
        </dl>
      ) : null}

      <button
        type="button"
        onClick={onAcknowledge}
        className="mt-2 inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-[var(--on-accent)] transition-transform duration-200 hover:scale-105"
      >
        {s.acknowledge}
      </button>
    </div>
  )
}
