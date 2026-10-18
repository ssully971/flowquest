import confetti from 'canvas-confetti'

/** Confettis à la dernière tâche cochée (§8 du cahier des charges) — palette incluant
 * l'améthyste de marque, pas un arc-en-ciel générique. */
const CONFETTI_COLORS = ['#8B5CF6', '#C4B5FD', '#F2ECFC', '#4A208C']

export function fireTaskListConfetti(): void {
  if (typeof window === 'undefined') return
  void confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.7 },
    colors: [...CONFETTI_COLORS],
    disableForReducedMotion: true,
  })
}
