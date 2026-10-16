import { BigDigits } from '@/shared/design-system'
import { useCurrentTime } from '@/shared/hooks/useCurrentTime'
import { strings } from '@/shared/i18n'

import { CLOCK_SIZE_SCALE, CLOCK_STYLE_CSS } from './clock-settings'
import { useClockSettings } from './clock-settings-context'
import { getGreeting } from './greeting'
import { useQuotesSettings } from './quotes-settings-context'
import { useQuote } from './useQuote'

interface ClockParts {
  label: string
  meridiem?: string
}

function formatClockParts(date: Date, format: '12h' | '24h', showSeconds: boolean): ClockParts {
  let hours = date.getHours()
  let meridiem: string | undefined
  if (format === '12h') {
    meridiem = hours >= 12 ? strings.home.clock.pm : strings.home.clock.am
    hours = hours % 12 || 12
  }
  const hh = hours.toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  const ss = date.getSeconds().toString().padStart(2, '0')
  const label = showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`
  return { label, meridiem }
}

function formatLongDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function HomeScreen() {
  const now = useCurrentTime()
  const { settings: clockSettings } = useClockSettings()
  const { settings: quotesSettings } = useQuotesSettings()
  const greeting = getGreeting(now)
  const quote = useQuote(now)
  const clock = formatClockParts(now, clockSettings.format, clockSettings.showSeconds)
  const styleCss = CLOCK_STYLE_CSS[clockSettings.style]

  return (
    <div className="relative h-full">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-8 px-6 pt-8 sm:px-14 sm:pt-16">
        <p
          className="text-[32px] font-semibold leading-none text-[var(--text)] sm:text-[36px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {strings.app.name}
        </p>
        {quotesSettings.showOnHome ? (
          <figure className="max-w-sm pt-1.5 text-right sm:max-w-md sm:pt-2">
            <blockquote className="text-[18px] leading-snug text-[var(--text)] sm:text-[20px]">
              “{quote.text}”
            </blockquote>
            <figcaption className="mt-1.5 text-sm text-[var(--muted)]">{quote.author}</figcaption>
          </figure>
        ) : null}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
        {clockSettings.showGreeting ? (
          <>
            <p
              className="w-full text-[28px] font-semibold text-[var(--text)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {greeting.primary}
            </p>
            <p className="w-full text-sm text-[var(--muted)]">{greeting.secondary}</p>
          </>
        ) : null}
        <BigDigits
          label={clock.label}
          meridiem={clock.meridiem}
          sizePx={208}
          sizeScale={CLOCK_SIZE_SCALE[clockSettings.size]}
          fontFamily={styleCss.fontFamily}
          fontWeight={styleCss.fontWeight}
          letterSpacing={styleCss.letterSpacing}
          fontStyle={styleCss.fontStyle}
          flip={clockSettings.flipClock}
        />
        <p className="w-full text-sm text-[var(--muted)]">{formatLongDate(now)}</p>
      </div>
    </div>
  )
}
