import { BigDigits } from '@/shared/design-system'

interface TimerDisplayProps {
  label: string
}

export function TimerDisplay({ label }: TimerDisplayProps) {
  return <BigDigits label={label} sizePx={176} />
}
