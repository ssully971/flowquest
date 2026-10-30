/**
 * Position de la carte d'horloge du mode Ambiant, déplaçable (LOT 2). Mémorisée en
 * POURCENTAGES de l'espace libre (0 = collée au bord haut/gauche, 1 = au bord bas/droit), jamais en
 * pixels : elle reste cohérente quand la fenêtre change de taille, et une position pour l'écran
 * « compact » (mobile) et une autre pour l'écran « large » (ordinateur, tablette) évitent qu'un
 * placement pensé pour l'un ne sorte de l'autre.
 */
export interface ClockPosition {
  x: number
  y: number
}

export type PositionKey = 'compact' | 'wide'

/** `null` : emplacement par défaut (en haut à droite sur grand écran, centré en haut sur mobile). */
export interface AmbientClockPositions {
  compact: ClockPosition | null
  wide: ClockPosition | null
}

export const DEFAULT_AMBIENT_POSITIONS: AmbientClockPositions = { compact: null, wide: null }

/** Largeur sous laquelle la mise en page passe en « compact » (point de rupture `sm` de Tailwind). */
export const COMPACT_MAX_WIDTH = 640

export function positionKeyForWidth(width: number): PositionKey {
  return width < COMPACT_MAX_WIDTH ? 'compact' : 'wide'
}

export function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function isClockPosition(value: unknown): value is ClockPosition {
  if (typeof value !== 'object' || value === null) return false
  const { x, y } = value as Record<string, unknown>
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
}

/** Lit un réglage enregistré en écartant tout ce qui n'est pas une position valide. */
export function sanitizeAmbientPositions(value: unknown): AmbientClockPositions {
  if (typeof value !== 'object' || value === null) return DEFAULT_AMBIENT_POSITIONS
  const record = value as Record<string, unknown>
  const clean = (candidate: unknown): ClockPosition | null =>
    isClockPosition(candidate) ? { x: clampUnit(candidate.x), y: clampUnit(candidate.y) } : null
  return { compact: clean(record.compact), wide: clean(record.wide) }
}

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** Position (en parts de l'espace libre) d'une carte `card` à l'intérieur de `region`, bornée à la
 * région : une carte qui sort de l'écran est ramenée contre le bord le plus proche. */
export function positionFromRects(region: Rect, card: Rect): ClockPosition {
  const freeX = region.width - card.width
  const freeY = region.height - card.height
  return {
    x: freeX > 0 ? clampUnit((card.left - region.left) / freeX) : 0.5,
    y: freeY > 0 ? clampUnit((card.top - region.top) / freeY) : 0.5,
  }
}

/** Déplace une position de `dx`/`dy` pixels dans une région dont l'espace libre est `free*`. */
export function movePosition(
  position: ClockPosition,
  dx: number,
  dy: number,
  freeWidth: number,
  freeHeight: number,
): ClockPosition {
  return {
    x: freeWidth > 0 ? clampUnit(position.x + dx / freeWidth) : position.x,
    y: freeHeight > 0 ? clampUnit(position.y + dy / freeHeight) : position.y,
  }
}

const KEY_STEP = 0.02
const KEY_STEP_LARGE = 0.1

/** Déplacement au clavier (flèches ; Maj = grand pas). Renvoie `null` pour une autre touche. */
export function stepPosition(
  position: ClockPosition,
  key: string,
  large: boolean,
): ClockPosition | null {
  const step = large ? KEY_STEP_LARGE : KEY_STEP
  switch (key) {
    case 'ArrowLeft':
      return { ...position, x: clampUnit(position.x - step) }
    case 'ArrowRight':
      return { ...position, x: clampUnit(position.x + step) }
    case 'ArrowUp':
      return { ...position, y: clampUnit(position.y - step) }
    case 'ArrowDown':
      return { ...position, y: clampUnit(position.y + step) }
    default:
      return null
  }
}
