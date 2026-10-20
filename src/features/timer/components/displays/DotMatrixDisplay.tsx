import type { ClockStyleCss } from '@/features/home/clock-settings'
import { BigDigits } from '@/shared/design-system'

interface DotMatrixDisplayProps {
  label: string
  progress: number
  compact?: boolean
  sizeScale?: number
  color?: string
  styleCss?: ClockStyleCss
}

export function DotMatrixDisplay({
  label,
  progress,
  compact = false,
  sizeScale = 1,
  color,
  styleCss,
}: DotMatrixDisplayProps) {
  const scale = compact ? 1 : sizeScale
  const columns = compact ? 6 : 10
  const rows = compact ? 3 : 4
  const total = columns * rows
  const clamped = Math.min(1, Math.max(0, progress))
  const filledCount = Math.round(clamped * total)
  const dotSizePx = (compact ? 4 : 8) * scale
  const gapPx = (compact ? 4 : 6) * scale

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-4'}`}>
      <BigDigits
        label={label}
        sizePx={compact ? 28 : 120}
        sizeScale={scale}
        color={color}
        fontFamily={styleCss?.fontFamily}
        fontWeight={styleCss?.fontWeight}
        letterSpacing={styleCss?.letterSpacing}
        fontStyle={styleCss?.fontStyle}
      />
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: gapPx }}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`rounded-full ${index < filledCount ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`}
            style={{ width: dotSizePx, height: dotSizePx }}
          />
        ))}
      </div>
    </div>
  )
}
