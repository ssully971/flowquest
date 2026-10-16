import { CLOCK_SIZE_SCALE, CLOCK_STYLE_CSS } from '@/features/home/clock-settings'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { BigDigits } from '@/shared/design-system'

interface TimerDisplayProps {
  label: string
}

export function TimerDisplay({ label }: TimerDisplayProps) {
  const { settings: clockSettings } = useClockSettings()
  const styleCss = CLOCK_STYLE_CSS[clockSettings.style]

  return (
    <BigDigits
      label={label}
      sizePx={176}
      sizeScale={CLOCK_SIZE_SCALE[clockSettings.size]}
      fontFamily={styleCss.fontFamily}
      fontWeight={styleCss.fontWeight}
      letterSpacing={styleCss.letterSpacing}
      fontStyle={styleCss.fontStyle}
      flip={clockSettings.flipClock}
    />
  )
}
