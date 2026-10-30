import type { AmbientClockPositions } from './clock-position'

export type ClockFormat = '12h' | '24h'
// `xs`/`s` ajoutées en LOT H2, §2 : avant, « Petite » (`small`) était la plus petite
// taille possible — certains écrans (mobile surtout) demandaient une horloge encore plus
// discrète.
export type ClockSize = 'xs' | 's' | 'small' | 'normal' | 'huge'

export const CLOCK_COLOR_AUTO = 'auto'
// Palettes par thème (lot 3 bis, §5) : l'ancienne palette (réutilisant TASK_COLORS) était
// trop vive et trop claire pour une horloge affichée en grand sur un fond photo. En sombre,
// des tons doux et légèrement désaturés ; en clair, des tons profonds — chacun vérifié à au
// moins 4,5:1 de contraste contre le fond de base du thème (voir clock-color-contrast.ts,
// THEME_SURFACE_HEX) par clock-color-contrast.test.ts.
export const CLOCK_COLORS_DARK = [
  '#F5F1EA', // blanc cassé
  '#C9BFE8', // lavande
  '#E3B8BE', // rose poudré
  '#A9D4C4', // vert d'eau
  '#D9C3A0', // sable
] as const
export const CLOCK_COLORS_LIGHT = [
  '#1A1A2E', // encre
  '#312E81', // indigo
  '#6B1F2A', // bordeaux
  '#1F4D3A', // vert forêt
  '#4A3222', // brun
] as const
export type ClockColor =
  | typeof CLOCK_COLOR_AUTO
  | (typeof CLOCK_COLORS_DARK)[number]
  | (typeof CLOCK_COLORS_LIGHT)[number]

export const CLOCK_COLORS_BY_THEME: Record<'dark' | 'light', readonly ClockColor[]> = {
  dark: CLOCK_COLORS_DARK,
  light: CLOCK_COLORS_LIGHT,
}

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
  /** Emplacement de la carte d'horloge du mode Ambiant (déplaçable), par taille d'écran ; absent ou
   * `null` : emplacement par défaut. Synchronisé avec le reste des réglages d'horloge. */
  ambientPositions?: AmbientClockPositions
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
  xs: 0.38,
  s: 0.5,
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
