import { strings } from '@/shared/i18n'

interface GoalProgressProps {
  completed: number
  target: number
}

export function GoalProgress({ completed, target }: GoalProgressProps) {
  const s = strings.focus.goal
  const unit = target === 1 ? s.session : s.sessions

  return (
    <p className="text-sm text-[var(--muted)]">
      {s.progress} : {completed}/{target} {unit}
    </p>
  )
}
