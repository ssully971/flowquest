import { BigDigits } from '@/shared/design-system'

interface ProgressBarDisplayProps {
  label: string
  progress: number
  compact?: boolean
}

export function ProgressBarDisplay({ label, progress, compact = false }: ProgressBarDisplayProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div
      className={`flex w-full flex-col items-center ${compact ? 'max-w-[120px] gap-2' : 'max-w-xs gap-4'}`}
    >
      <BigDigits label={label} sizePx={compact ? 28 : 120} />
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
