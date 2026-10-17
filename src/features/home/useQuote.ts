import { useMemo } from 'react'

import { pickDailyQuote, pickRandomQuote } from './quotes'
import type { Quote } from './quotes'
import { useQuotesSettings } from './quotes-settings-context'

/**
 * Citation courante selon la rotation choisie (§5.1 et §7.5 du cahier des charges) :
 * « daily » reste stable toute la journée et change au jour suivant ; « everyLoad » est
 * tirée une fois par montage (changer de catégorie en tire aussi une nouvelle, mais elle
 * ne tourne pas à chaque re-rendu).
 */
export function useQuote(now: Date): Quote {
  const { settings } = useQuotesSettings()
  const dayKey = now.toDateString()

  const dailyQuote = useMemo(
    () => pickDailyQuote(settings.category, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.category, dayKey],
  )
  const everyLoadQuote = useMemo(() => pickRandomQuote(settings.category), [settings.category])

  return settings.rotation === 'daily' ? dailyQuote : everyLoadQuote
}
