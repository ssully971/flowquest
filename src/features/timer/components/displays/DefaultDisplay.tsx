import { BigDigits } from '@/shared/design-system'

interface DefaultDisplayProps {
  label: string
  compact?: boolean
  sizeScale?: number
  color?: string
}

export function DefaultDisplay({ label, compact = false, sizeScale = 1, color }: DefaultDisplayProps) {
  return (
    <BigDigits
      label={label}
      sizePx={compact ? 36 : 176}
      sizeScale={compact ? 1 : sizeScale}
      color={color}
    />
  )
}
