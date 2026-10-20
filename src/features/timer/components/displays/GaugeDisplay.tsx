import type { ClockStyleCss } from '@/features/home/clock-settings'
import { BigDigits } from '@/shared/design-system'

interface GaugeDisplayProps {
  label: string
  progress: number
  compact?: boolean
  sizeScale?: number
  color?: string
  styleCss?: ClockStyleCss
}

export function GaugeDisplay({
  label,
  progress,
  compact = false,
  sizeScale = 1,
  color,
  styleCss,
}: GaugeDisplayProps) {
  const scale = compact ? 1 : sizeScale
  const size = (compact ? 72 : 200) * scale
  const stroke = (compact ? 6 : 10) * scale
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))
  const offset = circumference * (1 - clamped)

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 500ms linear' }}
        />
      </svg>
      <div className="absolute">
        <BigDigits
          label={label}
          sizePx={compact ? 16 : 64}
          sizeScale={scale}
          color={color}
          fontFamily={styleCss?.fontFamily}
          fontWeight={styleCss?.fontWeight}
          letterSpacing={styleCss?.letterSpacing}
          fontStyle={styleCss?.fontStyle}
        />
      </div>
    </div>
  )
}
