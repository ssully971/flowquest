import { Award, Coffee, Flame, ListChecks, Sparkles, Timer, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface StatCardTone {
  icon: LucideIcon
  gradient: string
}

/**
 * Dégradés vifs, une teinte par carte (inspiration docs/reference/stat-cards.jpeg —
 * ergonomie uniquement, pas les couleurs ni le texte copiés). Exception volontaire à la
 * règle « une seule couleur de marque » (§20.1) : comme les couleurs de tâches et les
 * confettis (lot 6), ce sont des éléments de contenu/célébration, pas du chrome
 * applicatif — la navigation, les boutons et le reste de l'interface restent améthyste.
 */
export const STAT_CARD_TONES = {
  currentStreak: { icon: Flame, gradient: 'linear-gradient(135deg, #FB923C, #EF4444)' },
  longestStreak: { icon: Award, gradient: 'linear-gradient(135deg, #FDE047, #F59E0B)' },
  focusTime: { icon: Zap, gradient: 'linear-gradient(135deg, #A78BFA, #7C3AED)' },
  sessionsCount: { icon: Timer, gradient: 'linear-gradient(135deg, #38BDF8, #2563EB)' },
  pauseTime: { icon: Coffee, gradient: 'linear-gradient(135deg, #2DD4BF, #0891B2)' },
  tasksCompleted: { icon: ListChecks, gradient: 'linear-gradient(135deg, #4ADE80, #16A34A)' },
  focusScore: { icon: Sparkles, gradient: 'linear-gradient(135deg, #F472B6, #DB2777)' },
} as const satisfies Record<string, StatCardTone>

export type StatCardToneKey = keyof typeof STAT_CARD_TONES
