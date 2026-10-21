import type { ClockStyleCss } from '@/features/home/clock-settings'
import { BigDigits } from '@/shared/design-system'

interface ProgressBarDisplayProps {
  label: string
  progress: number
  compact?: boolean
  sizeScale?: number
  color?: string
  styleCss?: ClockStyleCss
}

export function ProgressBarDisplay({
  label,
  progress,
  compact = false,
  sizeScale = 1,
  color,
  styleCss,
}: ProgressBarDisplayProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const scale = compact ? 1 : sizeScale
  const maxWidthPx = (compact ? 120 : 320) * scale

  return (
    <div
      className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-4'}`}
      style={{ width: '100%', maxWidth: maxWidthPx }}
    >
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
