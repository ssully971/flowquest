import type { ViewTransform } from './view-transform'

export interface DrawNode {
  id: string
  x: number
  y: number
  /** Rayon de simulation (collisions) : le rayon dessiné s'en déduit par `displayRadius`. */
  r: number
  kind: 'pillar' | 'task' | 'group'
  label: string
  color: string
  brightness: number
  done: boolean
  archived: boolean
  groupCount?: number
}

export interface DrawEdge {
  id: string
  /** Ids des extrémités : nécessaires à l'opacité par profondeur de la vue locale. */
  sourceId?: string
  targetId?: string
  kind: 'pillar' | 'parent' | 'depends_on' | 'related'
  from: { x: number; y: number; r: number; kind?: DrawNode['kind'] }
  to: { x: number; y: number; r: number; kind?: DrawNode['kind'] }
}

/** Couleurs lues des jetons `--cst-*` (tokens.css) : jamais de hex en dur dans le dessin. */
export interface DrawPalette {
  background: string
  edge: string
  edgeUser: string
  label: string
  labelStrong: string
  highlight: string
  font: string
  /** Police d'affichage (titres) : étiquette du nœud central en vue locale. */
  fontDisplay: string
}

export type LabelMode = 'auto' | 'always' | 'never'

export interface DrawHighlight {
  /** Nœud actif (survol ou sélection). */
  activeId: string
  nodeIds: ReadonlySet<string>
  edgeIds: ReadonlySet<string>
}

export interface DrawOptions {
  width: number
  height: number
  dpr: number
  view: ViewTransform
  nodes: DrawNode[]
  edges: DrawEdge[]
  palette: DrawPalette
  /** Nœuds cerclés (sélection). */
  selectedIds?: ReadonlySet<string>
  selectedEdgeId?: string | null
  /** Voisinage mis en avant ; tout le reste est estompé. */
  highlight?: DrawHighlight | null
  /** Lien en cours de tracé (mode « relier ») en coordonnées du monde. */
  linkDraft?: { from: { x: number; y: number }; to: { x: number; y: number } } | null
  /** `auto` : piliers toujours, tâches au-delà d'un zoom ou dans le voisinage actif. */
  labels?: LabelMode
  /** Multiplicateur de la taille des nœuds (réglage d'affichage), 1 par défaut. */
  nodeScale?: number
  /** Faux : les dépendances sont tracées sans flèche. */
  showArrows?: boolean
  /** Vue locale : nœud central (anneau à rayon + 7, étiquette en police d'affichage) et opacité
   * de chaque nœud selon sa profondeur (les liens prennent celle de leur extrémité la plus pâle). */
  local?: { centerId: string; opacityById: ReadonlyMap<string, number> } | null
}

/** Part d'opacité des éléments hors du voisinage actif. */
export const DIM_OPACITY = 0.28
/** Zoom à partir duquel les étiquettes de tâches s'affichent en mode auto. */
export const LABEL_ZOOM = 1.15
const ARCHIVED_OPACITY = 0.45

const FALLBACK_PALETTE: DrawPalette = {
  background: '#0e0c14',
  edge: '#3a3647',
  edgeUser: '#8a8499',
  label: '#8a8499',
  labelStrong: '#eeeaf4',
  highlight: '#c9a7ff',
  font: '"Instrument Sans Variable", system-ui, sans-serif',
  fontDisplay: '"Bricolage Grotesque Variable", system-ui, sans-serif',
}

/** Lit la palette du graphe depuis les jetons CSS (thème sombre ou clair en cours). */
export function readPalette(element: Element = document.documentElement): DrawPalette {
  const style = getComputedStyle(element)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    background: read('--cst-bg', FALLBACK_PALETTE.background),
    edge: read('--cst-edge', FALLBACK_PALETTE.edge),
    edgeUser: read('--cst-edge-user', FALLBACK_PALETTE.edgeUser),
    label: read('--cst-label', FALLBACK_PALETTE.label),
    labelStrong: read('--cst-label-strong', FALLBACK_PALETTE.labelStrong),
    highlight: read('--cst-highlight', FALLBACK_PALETTE.highlight),
    font: read('--font-sans', FALLBACK_PALETTE.font),
    fontDisplay: read('--font-display', FALLBACK_PALETTE.fontDisplay),
  }
}

/**
 * Rayon DESSINÉ d'un nœud, en unités du monde. Tâche : plafonné à 9 (lisibilité, pas d'énormes
 * bulles). Pilier : 11 × palier (le rayon de simulation vaut 14 × palier), plafonné à 1,4.
 * Groupe : sobre, de 9 à 13.
 */
export function displayRadius(node: { kind: DrawNode['kind']; r: number }, scale = 1): number {
  if (node.kind === 'pillar') return 11 * Math.min(1.4, node.r / 14) * scale
  if (node.kind === 'group') return Math.min(13, Math.max(9, node.r)) * scale
  return Math.min(9, node.r) * scale
}

/** Couleur #RRGGBB avec opacité ; autre format : renvoyé tel quel. */
function withAlpha(color: string, alpha: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
      .toString(16)
      .padStart(2, '0')
    return `${color}${a}`
  }
  return color
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: { x: number; y: number },
  angle: number,
  size: number,
): void {
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(tip.x - size * Math.cos(angle - 0.42), tip.y - size * Math.sin(angle - 0.42))
  ctx.lineTo(tip.x - size * Math.cos(angle + 0.42), tip.y - size * Math.sin(angle + 0.42))
  ctx.closePath()
  ctx.fill()
}

/**
 * Dessine toute la constellation : liens, nœuds, étiquettes. Rendu « graphe sobre » : aucune
 * lueur ni dégradé, un seul accent (la sélection), le voisinage actif en pleine opacité et le
 * reste estompé. Aucun état conservé : appelée à chaque image pendant un geste, une seule fois
 * au repos ou pour le fond d'écran.
 */
export function drawConstellation(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
  const { width, height, dpr, view, nodes, edges, palette, highlight } = options
  const selected = options.selectedIds ?? new Set<string>()
  const k = view.k
  const scale = options.nodeScale ?? 1
  const showArrows = options.showArrows ?? true

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.x, dpr * view.y)

  const local = options.local ?? null
  const depthAlpha = (id: string | undefined): number =>
    local && id ? (local.opacityById.get(id) ?? 1) : 1
  const nodeAlpha = (id: string): number =>
    (highlight && !highlight.nodeIds.has(id) ? DIM_OPACITY : 1) * depthAlpha(id)
  const edgeAlpha = (id: string): number =>
    highlight && !highlight.edgeIds.has(id) ? DIM_OPACITY : 1

  // Liens : le pilier→tâche reste discret, ceux de l'utilisateur sont lisibles, ceux du
  // voisinage actif passent à l'accent.
  for (const edge of edges) {
    const isUserLink = edge.kind === 'depends_on' || edge.kind === 'related'
    const inHighlight = highlight?.edgeIds.has(edge.id) ?? false
    const isSelectedEdge = edge.id === options.selectedEdgeId
    const emphasised = isSelectedEdge || (inHighlight && edge.kind !== 'pillar')
    const color = emphasised
      ? palette.highlight
      : edge.kind === 'pillar'
        ? palette.edge
        : palette.edgeUser
    ctx.lineWidth = (emphasised ? 1.5 : isUserLink ? 1.3 : 1) / k
    ctx.globalAlpha =
      (edge.kind === 'parent' && !emphasised ? 0.5 : 1) *
      (isSelectedEdge ? 1 : edgeAlpha(edge.id)) *
      Math.min(depthAlpha(edge.sourceId), depthAlpha(edge.targetId))
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.setLineDash(edge.kind === 'related' ? [4 / k, 4 / k] : [])
    ctx.beginPath()
    ctx.moveTo(edge.from.x, edge.from.y)
    ctx.lineTo(edge.to.x, edge.to.y)
    ctx.stroke()
    if (edge.kind === 'depends_on' && showArrows) {
      const dx = edge.to.x - edge.from.x
      const dy = edge.to.y - edge.from.y
      const length = Math.hypot(dx, dy) || 1
      const toRadius = displayRadius({ kind: edge.to.kind ?? 'task', r: edge.to.r }, scale)
      const gap = toRadius + 1.5
      drawArrowHead(
        ctx,
        { x: edge.to.x - (dx / length) * gap, y: edge.to.y - (dy / length) * gap },
        Math.atan2(dy, dx),
        6 / k + 1.5,
      )
    }
  }
  ctx.setLineDash([])

  if (options.linkDraft) {
    ctx.globalAlpha = 1
    ctx.strokeStyle = palette.highlight
    ctx.lineWidth = 1.4 / k
    ctx.setLineDash([4 / k, 4 / k])
    ctx.beginPath()
    ctx.moveTo(options.linkDraft.from.x, options.linkDraft.from.y)
    ctx.lineTo(options.linkDraft.to.x, options.linkDraft.to.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Nœuds : à plat, sans lueur. Les piliers d'abord (au-dessous), puis les tâches.
  const ordered = [...nodes].sort(
    (a, b) => (a.kind === 'pillar' ? 0 : 1) - (b.kind === 'pillar' ? 0 : 1),
  )
  for (const node of ordered) {
    const r = displayRadius(node, scale)
    const archivedFactor = node.archived ? ARCHIVED_OPACITY : 1
    ctx.globalAlpha = nodeAlpha(node.id) * archivedFactor

    if (node.kind === 'pillar') {
      // Anneau fin à rayon + 5 px (35 % d'opacité), puis disque plein.
      ctx.strokeStyle = withAlpha(node.color, 0.35)
      ctx.lineWidth = 1 / k
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = node.color
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fill()
    } else if (node.kind === 'group') {
      // Contour pointillé seul, sans fond.
      ctx.strokeStyle = node.color
      ctx.lineWidth = 1.4 / k
      ctx.setLineDash([3 / k, 3 / k])
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    } else if (node.done) {
      // Terminée : disque plein, liseré de 2 px couleur du fond pour la détacher des liens.
      ctx.fillStyle = node.color
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = palette.background
      ctx.lineWidth = 2 / k
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 1 / k, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // À faire : disque de la couleur du fond, contour 1,5 px de la couleur du pilier.
      ctx.fillStyle = palette.background
      ctx.strokeStyle = node.color
      ctx.lineWidth = 1.5 / k
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    if (local?.centerId === node.id) {
      // Vue locale : le centre porte un anneau plus large (rayon + 7).
      ctx.globalAlpha = 1
      ctx.strokeStyle = palette.labelStrong
      ctx.lineWidth = 1.5 / k
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 7, 0, Math.PI * 2)
      ctx.stroke()
    } else if (selected.has(node.id) || highlight?.activeId === node.id) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = palette.labelStrong
      ctx.lineWidth = 1.5 / k
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Étiquettes à taille d'écran constante, liseré couleur du fond pour la lisibilité.
  const mode = options.labels ?? 'auto'
  if (mode !== 'never') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const node of ordered) {
      const isActive = highlight?.activeId === node.id || selected.has(node.id)
      const inNeighborhood = highlight?.nodeIds.has(node.id) ?? false
      const show =
        mode === 'always' ||
        node.kind === 'pillar' ||
        node.kind === 'group' ||
        isActive ||
        inNeighborhood ||
        k >= LABEL_ZOOM
      if (!show) continue
      const isCenter = local?.centerId === node.id
      const strong = node.kind === 'pillar' || isActive || isCenter
      const fontPx = isCenter ? 13 : node.kind === 'pillar' ? 11.5 : 10.5
      ctx.font = `${strong ? 600 : 400} ${fontPx / k}px ${isCenter ? palette.fontDisplay : palette.font}`
      const text = node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label
      const r = displayRadius(node, scale)
      const y = node.y + r + (isCenter ? 12 : node.kind === 'pillar' ? 8 : 4) / k
      ctx.globalAlpha = nodeAlpha(node.id) * (node.archived ? ARCHIVED_OPACITY : 1)
      ctx.lineWidth = 3 / k
      ctx.lineJoin = 'round'
      ctx.strokeStyle = palette.background
      ctx.strokeText(text, node.x, y)
      ctx.fillStyle = strong ? palette.labelStrong : palette.label
      ctx.fillText(text, node.x, y)
    }
  }
  ctx.globalAlpha = 1
}
