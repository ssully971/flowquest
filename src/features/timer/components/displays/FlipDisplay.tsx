import { BigDigits } from '@/shared/design-system'

interface FlipDisplayProps {
  label: string
  compact?: boolean
}

export function FlipDisplay({ label, compact = false }: FlipDisplayProps) {
  return <BigDigits label={label} sizePx={compact ? 36 : 176} flip />
}
