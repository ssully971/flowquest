import { useState } from 'react'

import type { Quote, QuoteCategory } from '@/features/home/quotes'
import { pickRandomQuote } from '@/features/home/quotes'

/**
 * Citation de l'écran Focus (LOT G1, §Citations) : aléatoire au chargement, puis une
 * nouvelle à chaque début de phase (`phaseKey` change), jamais la même deux fois de
 * suite. `phaseKey` doit identifier un début de phase précisément — voir FocusScreen,
 * qui construit cette clé à partir de `segment` et de `startedAt` (change à chaque
 * démarrage réel, pas en changeant simplement d'onglet de segment sans démarrer, ni en
 * mettant en pause/reprenant). `null` tant qu'aucune phase n'a encore démarré : la
 * citation du chargement reste affichée sans changer.
 *
 * Volontairement indépendante du réglage « rotation » (quotidienne/à chaque chargement,
 * Réglages > Citations) : ce réglage reste pertinent pour l'Accueil (useQuote), mais sur
 * Focus le rythme naturel est celui des phases, pas du jour ou du montage du composant.
 */
export function usePhaseQuote(
  category: QuoteCategory | 'all',
  pool: Quote[],
  phaseKey: string | null,
): Quote {
  const [quote, setQuote] = useState<Quote>(() => pickRandomQuote(category, pool))
  const [lastKey, setLastKey] = useState<string | null>(phaseKey)

  if (phaseKey !== null && phaseKey !== lastKey) {
    setLastKey(phaseKey)
    setQuote((previous) => pickRandomQuote(category, pool, previous))
  }

  return quote
}
