import { useCallback, useEffect, useState } from 'react'

/** Décompte en secondes pour désactiver un bouton « renvoyer » un moment après usage
 * (évite le spam d'e-mails de confirmation/réinitialisation). */
export function useCooldown(seconds: number): { remaining: number; start: () => void } {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const intervalId = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [remaining])

  const start = useCallback(() => setRemaining(seconds), [seconds])

  return { remaining, start }
}
