import { useEffect, useState } from 'react'

import { fetchQuotePool } from './quote-pool'
import { QUOTES } from './quotes'
import type { Quote } from './quotes'

/**
 * Pool de citations effectif : QUOTES (statique) jusqu'à ce que la base réponde, puis
 * remplacé par les citations actives si la base en contient. Un seul chargement par
 * montage, pas de re-fetch à chaque citation tirée.
 */
export function useQuotePool(): Quote[] {
  const [pool, setPool] = useState<Quote[]>(QUOTES)

  useEffect(() => {
    let cancelled = false
    void fetchQuotePool().then((result) => {
      if (!cancelled) setPool(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return pool
}
