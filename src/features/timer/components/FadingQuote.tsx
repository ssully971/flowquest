import { useEffect, useState } from 'react'

import type { Quote } from '@/features/home/quotes'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'

const FADE_MS = 300

interface FadingQuoteProps {
  quote: Quote
  className?: string
}

/**
 * Citation avec fondu d'opacité ~300 ms au changement (LOT G1, §Citations) — supprimé si
 * prefers-reduced-motion (bascule immédiate, sans transition). Même balisage
 * blockquote/figcaption que l'affichage existant (Accueil, Focus) : seul le fondu est
 * nouveau, pas le placement ni la taille.
 */
export function FadingQuote({ quote, className = 'max-w-sm' }: FadingQuoteProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [displayed, setDisplayed] = useState(quote)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const changed = quote.text !== displayed.text || quote.author !== displayed.author

  // Ajuste l'état pendant le rendu plutôt que dans un effet (la citation affichée dérive
  // directement de la prop) : sans mouvement réduit, un seul indicateur « en train de
  // disparaître » suffit à déclencher le fondu ci-dessous ; avec mouvement réduit, la
  // bascule est immédiate, toujours pendant le rendu, jamais de minuteur.
  if (changed) {
    if (reducedMotion) {
      setDisplayed(quote)
    } else if (!isFadingOut) {
      setIsFadingOut(true)
    }
  }

  useEffect(() => {
    if (!isFadingOut) return
    const timeout = window.setTimeout(() => {
      setDisplayed(quote)
      setIsFadingOut(false)
    }, FADE_MS)
    return () => window.clearTimeout(timeout)
  }, [isFadingOut, quote])

  return (
    <figure
      className={className}
      style={{
        opacity: isFadingOut ? 0 : 1,
        transition: reducedMotion ? 'none' : `opacity ${FADE_MS}ms ease`,
      }}
    >
      <blockquote className="text-sm italic text-[var(--muted)]">“{displayed.text}”</blockquote>
      <figcaption className="mt-1 text-xs text-[var(--muted)]">{displayed.author}</figcaption>
    </figure>
  )
}
