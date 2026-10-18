import { BigDigits } from '@/shared/design-system'

interface DotMatrixDisplayProps {
  label: string
  progress: number
  compact?: boolean
}

export function DotMatrixDisplay({ label, progress, compact = false }: DotMatrixDisplayProps) {
  const columns = compact ? 6 : 10
  const rows = compact ? 3 : 4
  const total = columns * rows
  const clamped = Math.min(1, Math.max(0, progress))
  const filledCount = Math.round(clamped * total)

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-4'}`}>
      <BigDigits label={label} sizePx={compact ? 28 : 120} />
      <div
        className={compact ? 'grid gap-1' : 'grid gap-1.5'}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`rounded-full ${compact ? 'h-1 w-1' : 'h-2 w-2'} ${
              index < filledCount ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
