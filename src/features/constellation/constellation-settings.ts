import type { LabelMode } from './draw-constellation'

export interface ConstellationSettings {
  labels: LabelMode
  showTodo: boolean
  showArrows: boolean
  showArchived: boolean
  /** Multiplicateur de la taille des nœuds, de 0,6 à 1,6. */
  nodeScale: number
}

export const DEFAULT_CONSTELLATION_SETTINGS: ConstellationSettings = {
  labels: 'auto',
  showTodo: true,
  showArrows: true,
  showArchived: false,
  nodeScale: 1,
}

export const MIN_NODE_SCALE = 0.6
export const MAX_NODE_SCALE = 1.6

// Identifiant technique historique (préfixe commun de toutes les clés, voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.constellationSettings'
const HINT_KEY = 'flowquest.constellationHintSeen'

export function normalizeSettings(value: unknown): ConstellationSettings {
  const base = DEFAULT_CONSTELLATION_SETTINGS
  if (typeof value !== 'object' || value === null) return base
  const v = value as Record<string, unknown>
  const scale =
    typeof v.nodeScale === 'number' && Number.isFinite(v.nodeScale) ? v.nodeScale : base.nodeScale
  return {
    labels:
      v.labels === 'always' || v.labels === 'never' || v.labels === 'auto' ? v.labels : base.labels,
    showTodo: typeof v.showTodo === 'boolean' ? v.showTodo : base.showTodo,
    showArrows: typeof v.showArrows === 'boolean' ? v.showArrows : base.showArrows,
    showArchived: typeof v.showArchived === 'boolean' ? v.showArchived : base.showArchived,
    nodeScale: Math.min(MAX_NODE_SCALE, Math.max(MIN_NODE_SCALE, scale)),
  }
}

export function readConstellationSettings(): ConstellationSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_CONSTELLATION_SETTINGS
  } catch {
    return DEFAULT_CONSTELLATION_SETTINGS
  }
}

export function writeConstellationSettings(settings: ConstellationSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Stockage indisponible : les réglages valent pour cette visite seulement.
  }
}

/** L'aide « Glisse un nœud… » disparaît après la première interaction (mémorisé). */
export function hasSeenConstellationHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return true
  }
}

export function markConstellationHintSeen(): void {
  try {
    window.localStorage.setItem(HINT_KEY, '1')
  } catch {
    // Sans conséquence : l'aide se réaffichera.
  }
}
