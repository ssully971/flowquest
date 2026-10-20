import { BigDigits } from '@/shared/design-system'

interface FlipDisplayProps {
  label: string
  compact?: boolean
  sizeScale?: number
}

export function FlipDisplay({ label, compact = false, sizeScale = 1 }: FlipDisplayProps) {
  return <BigDigits label={label} sizePx={compact ? 36 : 176} sizeScale={compact ? 1 : sizeScale} flip />
}
