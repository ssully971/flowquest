import { BigDigits } from '@/shared/design-system'

interface DefaultDisplayProps {
  label: string
  compact?: boolean
}

export function DefaultDisplay({ label, compact = false }: DefaultDisplayProps) {
  return <BigDigits label={label} sizePx={compact ? 36 : 176} />
}
