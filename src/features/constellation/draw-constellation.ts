import type { ViewTransform } from './view-transform'

export interface DrawNode {
  id: string
  x: number
  y: number
  r: number
  kind: 'pillar' | 'task' | 'group'
  label: string
  color: string
  brightness: number
  done: boolean
  archived: boolean
  /** Pilier : apparence de l'étoile (palier). */
  star?: { points: number; halo: number }
  groupCount?: number
}

export interface DrawEdge {
  id: string
  kind: 'pillar' | 'parent' | 'depends_on' | 'related'
  from: { x: number; y: number; r: number }
  to: { x: number; y: number; r: number }
}

export interface DrawPalette {
  /** Texte et traits clairs ou sombres selon le fond. */
  text: string
  /** Couleur du fond, pour le liseré des étiquettes (lisibilité sur photo). */
  background: string
}

export interface DrawOptions {
  width: number
  height: number
  dpr: number
  view: ViewTransform
  nodes: DrawNode[]
  edges: DrawEdge[]
  palette: DrawPalette
  selectedIds?: ReadonlySet<string>
  hoverId?: string | null
  selectedEdgeId?: string | null
  /** Lien en cours de tracé (mode « relier ») en coordonnées du monde. */
  linkDraft?: { from: { x: number; y: number }; to: { x: number; y: number } } | null
  /** `auto` : étiquettes des piliers, puis des tâches au-delà d'un zoom ; `none` : aucune. */
  labels?: 'auto' | 'none'
}

/** Étoile à `points` branches (4, 5, 6 ou 8), rayon extérieur `r`, rayon intérieur 0,45·r. */
function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  points: number,
): void {
  const inner = r * 0.45
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : inner
    const angle = (Math.PI * i) / points - Math.PI / 2
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function withAlpha(color: string, alpha: number): string {
  // Couleurs de l'app : #RRGGBB. Autre format : alpha global via globalAlpha par l'appelant.
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
      .toString(16)
      .padStart(2, '0')
    return `${color}${a}`
  }
  return color
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - size * Math.cos(angle - 0.4), to.y - size * Math.sin(angle - 0.4))
  ctx.lineTo(to.x - size * Math.cos(angle + 0.4), to.y - size * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

/** Dessine toute la constellation (liens, nœuds, étiquettes). Aucun état conservé : appelée à
 * chaque image pendant un geste, et une seule fois au repos ou pour le fond d'écran. */
export function drawConstellation(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
  const { width, height, dpr, view, nodes, edges, palette } = options
  const selected = options.selectedIds ?? new Set<string>()
  const k = view.k

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.x, dpr * view.y)

  // Liens : les implicites (pilier, parent) très discrets, ceux de l'utilisateur lisibles.
  for (const edge of edges) {
    const isLink = edge.kind === 'depends_on' || edge.kind === 'related'
    const isSelected = edge.id === options.selectedEdgeId
    ctx.lineWidth = (isSelected ? 2.4 : isLink ? 1.4 : 1) / k
    ctx.globalAlpha = isSelected
      ? 1
      : edge.kind === 'pillar'
        ? 0.16
        : edge.kind === 'parent'
          ? 0.3
          : 0.55
    ctx.strokeStyle = palette.text
    ctx.fillStyle = palette.text
    ctx.setLineDash(edge.kind === 'related' ? [5 / k, 4 / k] : [])
    ctx.beginPath()
    ctx.moveTo(edge.from.x, edge.from.y)
    ctx.lineTo(edge.to.x, edge.to.y)
    ctx.stroke()
    if (edge.kind === 'depends_on') {
      const dx = edge.to.x - edge.from.x
      const dy = edge.to.y - edge.from.y
      const length = Math.hypot(dx, dy) || 1
      const tip = {
        x: edge.to.x - (dx / length) * (edge.to.r + 2),
        y: edge.to.y - (dy / length) * (edge.to.r + 2),
      }
      drawArrow(ctx, edge.from, tip, 7 / k)
    }
  }
  ctx.setLineDash([])

  if (options.linkDraft) {
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = palette.text
    ctx.lineWidth = 1.6 / k
    ctx.setLineDash([4 / k, 4 / k])
    ctx.beginPath()
    ctx.moveTo(options.linkDraft.from.x, options.linkDraft.from.y)
    ctx.lineTo(options.linkDraft.to.x, options.linkDraft.to.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Nœuds : piliers au-dessous, puis tâches (les allumées ont une lueur de la couleur du pilier).
  const ordered = [...nodes].sort(
    (a, b) => (a.kind === 'pillar' ? 0 : 1) - (b.kind === 'pillar' ? 0 : 1),
  )
  for (const node of ordered) {
    const dim = node.archived ? 0.55 : 1
    if (node.kind === 'pillar') {
      const halo = node.star?.halo ?? 0
      const haloRadius = node.r * (1.7 + halo * 1.6)
      const gradient = ctx.createRadialGradient(
        node.x,
        node.y,
        node.r * 0.4,
        node.x,
        node.y,
        haloRadius,
      )
      gradient.addColorStop(0, withAlpha(node.color, 0.28 + 0.3 * halo))
      gradient.addColorStop(1, withAlpha(node.color, 0))
      ctx.globalAlpha = dim
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2)
      ctx.fill()
      starPath(ctx, node.x, node.y, node.r, node.star?.points ?? 4)
      ctx.fillStyle = node.color
      ctx.globalAlpha = dim * Math.min(1, 0.55 + node.brightness * 0.45)
      ctx.fill()
    } else if (node.kind === 'group') {
      ctx.globalAlpha = 0.85 * dim
      ctx.strokeStyle = node.color
      ctx.fillStyle = withAlpha(node.color, 0.22)
      ctx.lineWidth = 1.6 / k
      ctx.setLineDash([3 / k, 3 / k])
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      if (node.done) {
        const glow = node.r * 2.6
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          node.r * 0.3,
          node.x,
          node.y,
          glow,
        )
        gradient.addColorStop(0, withAlpha(node.color, 0.5))
        gradient.addColorStop(1, withAlpha(node.color, 0))
        ctx.globalAlpha = dim
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, glow, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = dim
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
      if (node.done) {
        ctx.fillStyle = node.color
        ctx.fill()
      } else {
        // À faire : disque sombre translucide cerclé de la couleur, d'autant plus rempli qu'on y a travaillé.
        ctx.fillStyle = withAlpha(node.color, node.brightness * 0.6)
        ctx.fill()
        ctx.strokeStyle = node.color
        ctx.lineWidth = 1.5 / k
        ctx.stroke()
      }
    }

    if (selected.has(node.id) || options.hoverId === node.id) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = palette.text
      ctx.lineWidth = 2 / k
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.r + 4 / k, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Étiquettes à taille d'écran constante, avec un liseré de la couleur du fond pour rester
  // lisibles sur une photo.
  if (options.labels !== 'none') {
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const node of ordered) {
      const forced = selected.has(node.id) || options.hoverId === node.id
      const show =
        forced || node.kind === 'pillar' || node.kind === 'group' || (k >= 1.15 && node.r * k >= 6)
      if (!show) continue
      const fontPx = node.kind === 'pillar' ? 13 : 11
      ctx.font = `${node.kind === 'pillar' ? 600 : 500} ${fontPx / k}px "Instrument Sans Variable", system-ui, sans-serif`
      const text = node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label
      const y = node.y + node.r + 5 / k
      ctx.lineWidth = 3 / k
      ctx.strokeStyle = withAlpha(palette.background, 0.75)
      ctx.strokeText(text, node.x, y)
      ctx.fillStyle = palette.text
      ctx.fillText(text, node.x, y)
    }
  }
  ctx.globalAlpha = 1
}
