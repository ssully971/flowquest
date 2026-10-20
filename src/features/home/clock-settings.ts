import { TASK_COLORS } from '@/features/tasks/task-color'

export type ClockFormat = '12h' | '24h'
export type ClockSize = 'small' | 'normal' | 'huge'

export const CLOCK_COLOR_AUTO = 'auto'
// Réutilise la palette des couleurs de tâches (§8, exception documentée à la règle « une
// seule couleur de marque » §20.1 — déjà étendue aux confettis et aux cartes de stats) :
// une seule palette « contenu » cohérente dans toute l'app plutôt qu'une nouvelle liste.
export const CLOCK_COLORS = TASK_COLORS
export type ClockColor = typeof CLOCK_COLOR_AUTO | (typeof CLOCK_COLORS)[number]

export const CLOCK_STYLES = [
  'default-bold',
  'default-light',
  'soft',
  'bubble',
  'minimal-light',
  'minimal',
  'serif',
  'serif-condensed',
  'sporty',
  'heavy-wide',
  'digital',
  'handwritten',
] as const

export type ClockStyle = (typeof CLOCK_STYLES)[number]

export interface ClockSettings {
  format: ClockFormat
  size: ClockSize
  showSeconds: boolean
  showGreeting: boolean
  flipClock: boolean
  style: ClockStyle
  color: ClockColor
}

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = {
  format: '24h',
  size: 'small',
  showSeconds: false,
  showGreeting: true,
  flipClock: false,
  style: 'default-bold',
  color: CLOCK_COLOR_AUTO,
}

/** `undefined` laisse BigDigits suivre var(--text) (comportement « Auto »). */
export function resolveClockColor(color: ClockColor): string | undefined {
  return color === CLOCK_COLOR_AUTO ? undefined : color
}

export const CLOCK_SIZE_SCALE: Record<ClockSize, number> = {
  small: 0.62,
  normal: 1,
  huge: 1.35,
}

export interface ClockStyleCss {
  fontFamily: string
  fontWeight: number
  letterSpacing: string
  fontStyle?: 'italic' | 'normal'
}

/**
 * Les 12 styles de police du §7.2 du cahier des charges sont normalement des polices
 * libres de droits auto-hébergées. Pour cette première version, chaque style combine la
 * graisse/l'inclinaison/l'espacement des deux polices variables déjà auto-hébergées de
 * l'app (Bricolage Grotesque, Instrument Sans) avec des piles système sobres (serif,
 * monospace, cursive) pour les styles qui s'y prêtent — aucun fichier de police
 * supplémentaire à charger. Choix fait avec l'utilisateur ; de vraies polices dédiées
 * pourront remplacer ces piles plus tard sans changer l'API de ce module.
 */
export const CLOCK_STYLE_CSS: Record<ClockStyle, ClockStyleCss> = {
  'default-bold': { fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.04em' },
  'default-light': {
    fontFamily: 'var(--font-display)',
    fontWeight: 300,
    letterSpacing: '-0.02em',
  },
  soft: { fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0em' },
  bubble: { fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.01em' },
  'minimal-light': { fontFamily: 'var(--font-sans)', fontWeight: 300, letterSpacing: '-0.02em' },
  minimal: { fontFamily: 'var(--font-sans)', fontWeight: 400, letterSpacing: '-0.01em' },
  serif: {
    fontFamily: 'Georgia, "Times New Roman", Times, serif',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  'serif-condensed': {
    fontFamily: '"Iowan Old Style", Georgia, "Times New Roman", serif',
    fontWeight: 600,
    letterSpacing: '-0.04em',
  },
  sporty: {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    letterSpacing: '0.01em',
    fontStyle: 'italic',
  },
  'heavy-wide': { fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '0.05em' },
  digital: {
    fontFamily:
      '"SF Mono", SFMono-Regular, ui-monospace, Menlo, Consolas, "Liberation Mono", monospace',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  handwritten: {
    fontFamily: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
    fontWeight: 500,
    letterSpacing: '0.01em',
  },
}
