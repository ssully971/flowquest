import confetti from 'canvas-confetti'

/** Même palette que la liste de tâches (§8) pour rester cohérent avec le reste de l'app. */
const CONFETTI_COLORS = ['#8B5CF6', '#C4B5FD', '#F2ECFC', '#4A208C']

/**
 * Confettis qui tombent du haut de l'écran à la fin d'une session (LOT E6), désactivés
 * par défaut. `disableForReducedMotion` fait respecter prefers-reduced-motion sans
 * vérification manuelle — canvas-confetti n'anime alors rien du tout.
 */
export function fireSessionEndConfetti(): void {
  if (typeof window === 'undefined') return
  void confetti({
    particleCount: 160,
    angle: 270,
    spread: 100,
    startVelocity: 35,
    gravity: 0.9,
    origin: { x: 0.5, y: -0.1 },
    colors: [...CONFETTI_COLORS],
    disableForReducedMotion: true,
  })
}
