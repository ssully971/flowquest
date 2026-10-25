import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Préférence système « mouvement réduit », suivie en direct (pas seulement lue une fois
 * au montage) : utilisée par toute animation facultative de l'app (fondu de citation —
 * LOT G1, scintillement de la galaxie — LOT G4...) pour se couper sans redémarrage. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia(QUERY)
    const handleChange = () => setReduced(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return reduced
}
