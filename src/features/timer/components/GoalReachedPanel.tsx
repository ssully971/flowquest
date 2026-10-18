import { PartyPopper } from 'lucide-react'

import { strings } from '@/shared/i18n'

interface GoalReachedPanelProps {
  completed: number
  onContinue: () => void
}

export function GoalReachedPanel({ completed, onContinue }: GoalReachedPanelProps) {
  const s = strings.focus.goal
  const unit = completed === 1 ? s.session : s.sessions

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
        {s.reachedTitle}
      </p>
      <p className="text-sm text-[var(--muted)]">
        {s.reachedBody} {completed} {unit}. {s.reachedSuffix}
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-2 inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-[var(--on-accent)] transition-transform duration-200 hover:scale-105"
      >
        {s.continue}
      </button>
    </div>
  )
}
