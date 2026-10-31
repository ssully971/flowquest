import type { Bounds, ViewTransform } from './view-transform'

export interface MinimapTransform {
  /** Échelle monde → mini-carte. */
  scale: number
  offsetX: number
  offsetY: number
}

/** Cadre tout le contenu dans la mini-carte (marge en pixels), centré. */
export function minimapTransform(
  bounds: Bounds | null,
  width: number,
  height: number,
  padding = 8,
): MinimapTransform {
  if (!bounds) return { scale: 1, offsetX: width / 2, offsetY: height / 2 }
  const w = Math.max(1, bounds.maxX - bounds.minX)
  const h = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min((width - padding * 2) / w, (height - padding * 2) / h)
  return {
    scale,
    offsetX: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    offsetY: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  }
}

export function worldToMinimap(
  t: MinimapTransform,
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: x * t.scale + t.offsetX, y: y * t.scale + t.offsetY }
}

export function minimapToWorld(
  t: MinimapTransform,
  mx: number,
  my: number,
): { x: number; y: number } {
  return { x: (mx - t.offsetX) / t.scale, y: (my - t.offsetY) / t.scale }
}

/** Rectangle de la vue courante, en coordonnées du monde. */
export function viewportWorldRect(
  view: ViewTransform,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  return { x: -view.x / view.k, y: -view.y / view.k, w: width / view.k, h: height / view.k }
}

/** Vue qui centre le point du monde (wx, wy) sans changer le zoom. */
export function viewCenteredOn(
  view: ViewTransform,
  wx: number,
  wy: number,
  width: number,
  height: number,
): ViewTransform {
  return { k: view.k, x: width / 2 - wx * view.k, y: height / 2 - wy * view.k }
}
