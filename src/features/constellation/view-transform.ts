/** Transformation de la vue : monde → écran = (x_monde · k + x, y_monde · k + y). */
export interface ViewTransform {
  x: number
  y: number
  k: number
}

export const MIN_ZOOM = 0.15
export const MAX_ZOOM = 4

export const IDENTITY_VIEW: ViewTransform = { x: 0, y: 0, k: 1 }

export function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}

export function screenToWorld(
  view: ViewTransform,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k }
}

/** Zoome d'un facteur autour d'un point de l'écran : ce point reste fixe sous le doigt/curseur. */
export function zoomAt(view: ViewTransform, sx: number, sy: number, factor: number): ViewTransform {
  const k = clampZoom(view.k * factor)
  const real = k / view.k
  return { k, x: sx - (sx - view.x) * real, y: sy - (sy - view.y) * real }
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsOf(points: { x: number; y: number; r: number }[]): Bounds | null {
  if (points.length === 0) return null
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const p of points) {
    bounds.minX = Math.min(bounds.minX, p.x - p.r)
    bounds.minY = Math.min(bounds.minY, p.y - p.r)
    bounds.maxX = Math.max(bounds.maxX, p.x + p.r)
    bounds.maxY = Math.max(bounds.maxY, p.y + p.r)
  }
  return bounds
}

/** Cadre tout le contenu dans la zone visible (marge en pixels), sans dépasser un zoom de 1,6
 * pour qu'une constellation minuscule ne soit pas grossie démesurément. */
export function fitView(
  bounds: Bounds | null,
  width: number,
  height: number,
  padding = 48,
): ViewTransform {
  if (!bounds || width <= 0 || height <= 0) return { x: width / 2, y: height / 2, k: 1 }
  const w = Math.max(1, bounds.maxX - bounds.minX)
  const h = Math.max(1, bounds.maxY - bounds.minY)
  const k = clampZoom(Math.min(1.6, (width - padding * 2) / w, (height - padding * 2) / h))
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return { k, x: width / 2 - cx * k, y: height / 2 - cy * k }
}

export interface HitNode {
  id: string
  x: number
  y: number
  r: number
}

/** Nœud sous un point du monde (le plus proche du centre, rayon + tolérance en pixels écran). */
export function hitTestNode(
  nodes: HitNode[],
  wx: number,
  wy: number,
  k: number,
  tolerancePx = 6,
): string | null {
  let best: string | null = null
  let bestDistance = Infinity
  for (const node of nodes) {
    const distance = Math.hypot(node.x - wx, node.y - wy)
    if (distance <= node.r + tolerancePx / k && distance < bestDistance) {
      best = node.id
      bestDistance = distance
    }
  }
  return best
}

/** Distance d'un point à un segment — pour cliquer sur un lien afin de le supprimer. */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
