import type { ClockStyleCss } from '@/features/home/clock-settings'
import { BigDigits } from '@/shared/design-system'

interface FlipDisplayProps {
  label: string
  compact?: boolean
  sizeScale?: number
  color?: string
  styleCss?: ClockStyleCss
}

export function FlipDisplay({
  label,
  compact = false,
  sizeScale = 1,
  color,
  styleCss,
}: FlipDisplayProps) {
  return (
    <BigDigits
      label={label}
      sizePx={compact ? 36 : 176}
      sizeScale={compact ? 1 : sizeScale}
      color={color}
      fontFamily={styleCss?.fontFamily}
      fontWeight={styleCss?.fontWeight}
      letterSpacing={styleCss?.letterSpacing}
      fontStyle={styleCss?.fontStyle}
      flip
    />
  )
}
