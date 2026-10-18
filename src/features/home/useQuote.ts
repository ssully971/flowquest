import { useMemo } from 'react'

import { pickDailyQuote, pickRandomQuote } from './quotes'
import type { Quote } from './quotes'
import { useQuotesSettings } from './quotes-settings-context'
import { useQuotePool } from './useQuotePool'

/**
 * Citation courante selon la rotation choisie (§5.1 et §7.5 du cahier des charges) :
 * « daily » reste stable toute la journée et change au jour suivant ; « everyLoad » est
 * tirée une fois par montage (changer de catégorie en tire aussi une nouvelle, mais elle
 * ne tourne pas à chaque re-rendu). Le pool vient du panneau Admin (§12) quand disponible,
 * sinon du tableau statique (voir useQuotePool).
 */
export function useQuote(now: Date): Quote {
  const { settings } = useQuotesSettings()
  const pool = useQuotePool()
  const dayKey = now.toDateString()

  const dailyQuote = useMemo(
    () => pickDailyQuote(settings.category, now, pool),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.category, dayKey, pool],
  )
  const everyLoadQuote = useMemo(
    () => pickRandomQuote(settings.category, pool),
    [settings.category, pool],
  )

  return settings.rotation === 'daily' ? dailyQuote : everyLoadQuote
}
