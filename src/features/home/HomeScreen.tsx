import { BigDigits } from '@/shared/design-system'
import { useCurrentTime } from '@/shared/hooks/useCurrentTime'
import { strings } from '@/shared/i18n'

import { getGreeting } from './greeting'
import { getCurrentQuote } from './quotes'

function formatClockLabel(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
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
  const greeting = getGreeting(now)
  const quote = getCurrentQuote()

  return (
    <div className="relative h-full">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-6 px-6 pt-6 sm:px-10 sm:pt-8">
        <p
          className="text-lg font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {strings.app.name}
        </p>
        <figure className="max-w-xs text-right">
          <blockquote className="text-sm text-[var(--text)]">“{quote.text}”</blockquote>
          <figcaption className="mt-1 text-xs text-[var(--muted)]">{quote.author}</figcaption>
        </figure>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p
          className="w-full text-[28px] font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {greeting.primary}
        </p>
        <p className="w-full text-sm text-[var(--muted)]">{greeting.secondary}</p>
        <BigDigits label={formatClockLabel(now)} sizePx={208} />
        <p className="w-full text-sm text-[var(--muted)]">{formatLongDate(now)}</p>
      </div>
    </div>
  )
}
