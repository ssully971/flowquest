import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

import type { Graph } from './build-graph'
import { displayRadius, drawConstellation, readPalette } from './draw-constellation'
import type { DrawEdge, DrawNode, LabelMode } from './draw-constellation'
import { createSimulation, positionsOf } from './force-layout'
import { neighborhood } from './neighborhood'
import type { LayoutSimulation, Positions } from './force-layout'
import {
  boundsOf,
  distanceToSegment,
  fitView,
  hitTestNode,
  screenToWorld,
  zoomAt,
} from './view-transform'
import type { ViewTransform } from './view-transform'

export interface CanvasViewState extends ViewTransform {
  width: number
  height: number
}

export interface ConstellationCanvasHandle {
  recenter: () => void
  zoomBy: (factor: number) => void
  /** Centre la vue sur un point du monde, sans changer le zoom (mini-carte). */
  centerOn: (worldX: number, worldY: number) => void
}

interface ConstellationCanvasProps {
  graph: Graph
  /** Positions déjà calculées (settleLayout) : lues à chaque (re)construction du graphe. */
  positions: Positions
  /** Verrouillé : aucun geste ne bouge la vue ni les nœuds (les taps restent des sélections). */
  locked: boolean
  /** Mode « relier » : glisser d'un nœud à un autre crée un lien au lieu de déplacer le nœud. */
  linkMode: boolean
  selectedIds: ReadonlySet<string>
  selectedEdgeId: string | null
  /** Étiquettes : auto (défaut), toujours ou jamais. */
  labels?: LabelMode
  /** Multiplicateur de la taille des nœuds. */
  nodeScale?: number
  /** Faux : dépendances sans flèche. */
  showArrows?: boolean
  /** Vue locale : nœud central et opacité par profondeur. */
  local?: { centerId: string; opacityById: ReadonlyMap<string, number> } | null
  /** Change pour reconstruire la simulation et recadrer la vue (réorganiser, changer de centre). */
  layoutKey?: number | string
  /** Vue courante (zoom, décalage, taille) : pourcentage de zoom et mini-carte. */
  onViewChange?: (view: CanvasViewState) => void
  ariaLabel: string
  onSelectNode: (id: string | null) => void
  onSelectEdge: (edgeId: string | null) => void
  onLink: (fromId: string, toId: string) => void
  /** Nouvelles positions, après stabilisation ou déplacement manuel d'un nœud. */
  onPositionsChange: (positions: Positions) => void
}

const TAP_SLOP_PX = 5
const ALPHA_MIN = 0.02

interface Pointer {
  x: number
  y: number
  startX: number
  startY: number
  moved: boolean
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; startView: ViewTransform; startX: number; startY: number }
  | { kind: 'node'; id: string }
  | { kind: 'link'; fromId: string }
  | { kind: 'pinch'; startView: ViewTransform; startDistance: number; cx: number; cy: number }

/**
 * Canvas de la constellation : rendu 2D, zoom/pan souris, molette et pincement, déplacement des
 * nœuds, tracé de liens. Une image n'est dessinée que pendant un geste ou une simulation en cours
 * (rien ne tourne au repos). Verrouillé, les gestes sont ignorés (seuls les taps sélectionnent).
 */
export const ConstellationCanvas = forwardRef<ConstellationCanvasHandle, ConstellationCanvasProps>(
  function ConstellationCanvas(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const propsRef = useRef(props)
    propsRef.current = props

    const viewRef = useRef<ViewTransform>({ x: 0, y: 0, k: 1 })
    const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
    const layoutRef = useRef<LayoutSimulation | null>(null)
    const pointersRef = useRef(new Map<number, Pointer>())
    const gestureRef = useRef<Gesture>({ kind: 'none' })
    const hoverRef = useRef<string | null>(null)
    const draftRef = useRef<{
      from: { x: number; y: number }
      to: { x: number; y: number }
    } | null>(null)
    const rafRef = useRef<number | null>(null)
    const persistPendingRef = useRef(false)
    const fittedRef = useRef(false)
    const animRef = useRef<number | null>(null)
    const lastLayoutKeyRef = useRef(props.layoutKey)
    const lastEmittedRef = useRef<CanvasViewState | null>(null)

    const draw = useCallback(() => {
      const canvas = canvasRef.current
      const layout = layoutRef.current
      if (!canvas || !layout) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { graph, selectedIds, selectedEdgeId } = propsRef.current
      const meta = new Map(graph.nodes.map((node) => [node.id, node]))
      const byId = new Map(layout.nodes.map((node) => [node.id, node]))
      const drawNodes: DrawNode[] = []
      for (const sim of layout.nodes) {
        const node = meta.get(sim.id)
        if (!node) continue
        drawNodes.push({
          id: node.id,
          x: sim.x ?? 0,
          y: sim.y ?? 0,
          r: node.radius,
          kind: node.kind,
          label: node.label,
          color: node.color,
          brightness: node.brightness,
          done: node.done,
          archived: node.archived,
          groupCount: node.groupCount,
        })
      }
      const drawEdges: DrawEdge[] = []
      for (const edge of graph.edges) {
        const a = byId.get(edge.source)
        const b = byId.get(edge.target)
        if (!a || !b) continue
        drawEdges.push({
          id: edge.id,
          kind: edge.kind,
          sourceId: edge.source,
          targetId: edge.target,
          from: { x: a.x ?? 0, y: a.y ?? 0, r: a.r, kind: a.kind },
          to: { x: b.x ?? 0, y: b.y ?? 0, r: b.r, kind: b.kind },
        })
      }
      // Survol prioritaire, sinon la sélection : le voisinage reste net, le reste s'estompe.
      // En vue locale, l'opacité par profondeur suffit : la sélection (le centre) n'estompe pas
      // en plus le reste, seul le survol met un voisinage en avant.
      const activeId =
        hoverRef.current ?? (propsRef.current.local ? null : (Array.from(selectedIds)[0] ?? null))
      const highlight =
        activeId && meta.has(activeId) ? { activeId, ...neighborhood(graph, activeId) } : null
      drawConstellation(ctx, {
        ...sizeRef.current,
        view: viewRef.current,
        nodes: drawNodes,
        edges: drawEdges,
        palette: readPalette(),
        labels: propsRef.current.labels,
        nodeScale: propsRef.current.nodeScale,
        showArrows: propsRef.current.showArrows,
        local: propsRef.current.local,
        highlight,
        selectedIds,
        selectedEdgeId,
        linkDraft: draftRef.current,
      })
      // Émet la vue seulement si elle a changé (évite un rendu React par image au repos).
      const emitted = { ...viewRef.current, ...sizeRef.current }
      const last = lastEmittedRef.current
      if (
        !last ||
        last.x !== emitted.x ||
        last.y !== emitted.y ||
        last.k !== emitted.k ||
        last.width !== emitted.width ||
        last.height !== emitted.height
      ) {
        lastEmittedRef.current = emitted
        propsRef.current.onViewChange?.(emitted)
      }
    }, [])

    const loop = useCallback(() => {
      rafRef.current = null
      const layout = layoutRef.current
      if (layout && layout.simulation.alpha() > ALPHA_MIN) {
        layout.simulation.tick()
        draw()
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      draw()
      if (layout && persistPendingRef.current) {
        persistPendingRef.current = false
        propsRef.current.onPositionsChange(positionsOf(layout.nodes))
      }
    }, [draw])

    const requestFrame = useCallback(() => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop)
    }, [loop])

    /** Déplacement doux de la vue (250 ms) ; immédiat si l'utilisateur préfère moins d'animations. */
    const animateTo = useCallback(
      (target: ViewTransform, duration = 250) => {
        if (animRef.current !== null) cancelAnimationFrame(animRef.current)
        animRef.current = null
        const reduce =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce || duration <= 0) {
          viewRef.current = target
          requestFrame()
          return
        }
        const from = viewRef.current
        const start = performance.now()
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - progress, 3)
          viewRef.current = {
            x: from.x + (target.x - from.x) * eased,
            y: from.y + (target.y - from.y) * eased,
            k: from.k + (target.k - from.k) * eased,
          }
          draw()
          animRef.current = progress < 1 ? requestAnimationFrame(step) : null
        }
        animRef.current = requestAnimationFrame(step)
      },
      [draw, requestFrame],
    )

    const recenter = useCallback(
      (animated = false) => {
        const layout = layoutRef.current
        const { width, height } = sizeRef.current
        if (!layout) return
        const bounds = boundsOf(
          layout.nodes.map((node) => ({
            x: node.x ?? 0,
            y: node.y ?? 0,
            r: displayRadius(node, propsRef.current.nodeScale ?? 1) + 14,
          })),
        )
        const target = fitView(bounds, width, height)
        if (animated) animateTo(target)
        else {
          viewRef.current = target
          requestFrame()
        }
      },
      [animateTo, requestFrame],
    )

    useImperativeHandle(
      ref,
      () => ({
        recenter: () => recenter(false),
        zoomBy: (factor: number) => {
          const { width, height } = sizeRef.current
          viewRef.current = zoomAt(viewRef.current, width / 2, height / 2, factor)
          requestFrame()
        },
        centerOn: (worldX: number, worldY: number) => {
          const { width, height } = sizeRef.current
          const k = viewRef.current.k
          viewRef.current = { k, x: width / 2 - worldX * k, y: height / 2 - worldY * k }
          requestFrame()
        },
      }),
      [recenter, requestFrame],
    )

    // (Re)construit la simulation quand le graphe change ; les positions viennent du parent.
    useEffect(() => {
      layoutRef.current = createSimulation(props.graph, propsRef.current.positions)
      layoutRef.current.simulation.alpha(0)
      if (!fittedRef.current && sizeRef.current.width > 0) {
        fittedRef.current = true
        lastLayoutKeyRef.current = props.layoutKey
        recenter()
      } else if (lastLayoutKeyRef.current !== props.layoutKey) {
        // Nouveau centre, nouvelle profondeur, réorganisation : on recadre en douceur.
        lastLayoutKeyRef.current = props.layoutKey
        recenter(true)
      } else {
        requestFrame()
      }
    }, [props.graph, props.layoutKey, recenter, requestFrame])

    // Redessine quand la sélection change (sans simulation).
    useEffect(() => {
      requestFrame()
    }, [
      props.selectedIds,
      props.selectedEdgeId,
      props.labels,
      props.nodeScale,
      props.showArrows,
      requestFrame,
    ])

    // Taille du canvas (ratio de pixels plafonné à 2 pour rester léger sur mobile).
    useEffect(() => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return
      const resize = () => {
        const rect = container.getBoundingClientRect()
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        sizeRef.current = { width: rect.width, height: rect.height, dpr }
        canvas.width = Math.max(1, Math.round(rect.width * dpr))
        canvas.height = Math.max(1, Math.round(rect.height * dpr))
        if (!fittedRef.current && layoutRef.current && rect.width > 0) {
          fittedRef.current = true
          recenter()
        } else {
          requestFrame()
        }
      }
      resize()
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
      observer?.observe(container)
      return () => {
        observer?.disconnect()
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        if (animRef.current !== null) cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
    }, [recenter, requestFrame])

    // Molette : zoom autour du curseur (écouteur non passif pour pouvoir bloquer le défilement).
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const onWheel = (event: WheelEvent) => {
        if (propsRef.current.locked) return
        event.preventDefault()
        const rect = canvas.getBoundingClientRect()
        const factor = Math.exp(-event.deltaY * 0.0015)
        viewRef.current = zoomAt(
          viewRef.current,
          event.clientX - rect.left,
          event.clientY - rect.top,
          factor,
        )
        requestFrame()
      }
      canvas.addEventListener('wheel', onWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', onWheel)
    }, [requestFrame])

    const localPoint = (event: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const hitNodeAt = (sx: number, sy: number): string | null => {
      const layout = layoutRef.current
      if (!layout) return null
      const world = screenToWorld(viewRef.current, sx, sy)
      return hitTestNode(
        layout.nodes.map((node) => ({
          id: node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          r: displayRadius(node, propsRef.current.nodeScale ?? 1),
        })),
        world.x,
        world.y,
        viewRef.current.k,
        8,
      )
    }

    const hitEdgeAt = (sx: number, sy: number): string | null => {
      const layout = layoutRef.current
      if (!layout) return null
      const world = screenToWorld(viewRef.current, sx, sy)
      const byId = new Map(layout.nodes.map((node) => [node.id, node]))
      let best: string | null = null
      let bestDistance = 8 / viewRef.current.k
      for (const edge of propsRef.current.graph.edges) {
        if (!edge.linkId) continue
        const a = byId.get(edge.source)
        const b = byId.get(edge.target)
        if (!a || !b) continue
        const distance = distanceToSegment(world.x, world.y, a.x ?? 0, a.y ?? 0, b.x ?? 0, b.y ?? 0)
        if (distance < bestDistance) {
          best = edge.id
          bestDistance = distance
        }
      }
      return best
    }

    const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = localPoint(event)
      canvasRef.current?.setPointerCapture?.(event.pointerId)
      pointersRef.current.set(event.pointerId, {
        ...point,
        startX: point.x,
        startY: point.y,
        moved: false,
      })
      if (propsRef.current.locked) return

      if (pointersRef.current.size === 2) {
        const [a, b] = Array.from(pointersRef.current.values())
        gestureRef.current = {
          kind: 'pinch',
          startView: viewRef.current,
          startDistance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        }
        return
      }

      const hit = hitNodeAt(point.x, point.y)
      if (hit && propsRef.current.linkMode) {
        const world = screenToWorld(viewRef.current, point.x, point.y)
        gestureRef.current = { kind: 'link', fromId: hit }
        const from = layoutRef.current?.nodes.find((node) => node.id === hit)
        draftRef.current = { from: { x: from?.x ?? world.x, y: from?.y ?? world.y }, to: world }
      } else if (hit) {
        gestureRef.current = { kind: 'node', id: hit }
      } else {
        gestureRef.current = {
          kind: 'pan',
          startView: viewRef.current,
          startX: point.x,
          startY: point.y,
        }
      }
    }

    const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = localPoint(event)
      const pointer = pointersRef.current.get(event.pointerId)
      if (!pointer) {
        // Survol (souris) : curseur et mise en avant du nœud sous le pointeur.
        const hit = hitNodeAt(point.x, point.y)
        if (hit !== hoverRef.current) {
          hoverRef.current = hit
          if (canvasRef.current) canvasRef.current.style.cursor = hit ? 'pointer' : 'default'
          requestFrame()
        }
        return
      }
      pointer.x = point.x
      pointer.y = point.y
      if (Math.hypot(point.x - pointer.startX, point.y - pointer.startY) > TAP_SLOP_PX)
        pointer.moved = true

      const gesture = gestureRef.current
      if (propsRef.current.locked || !pointer.moved) return
      const layout = layoutRef.current

      if (gesture.kind === 'pan') {
        viewRef.current = {
          ...gesture.startView,
          x: gesture.startView.x + (point.x - gesture.startX),
          y: gesture.startView.y + (point.y - gesture.startY),
        }
        requestFrame()
      } else if (gesture.kind === 'node' && layout) {
        const world = screenToWorld(viewRef.current, point.x, point.y)
        const node = layout.nodes.find((candidate) => candidate.id === gesture.id)
        if (node) {
          node.fx = world.x
          node.fy = world.y
          node.pinned = true
          layout.simulation.alpha(Math.max(layout.simulation.alpha(), 0.25))
          persistPendingRef.current = true
          requestFrame()
        }
      } else if (gesture.kind === 'link' && draftRef.current) {
        draftRef.current = {
          ...draftRef.current,
          to: screenToWorld(viewRef.current, point.x, point.y),
        }
        requestFrame()
      } else if (gesture.kind === 'pinch' && pointersRef.current.size >= 2) {
        const [a, b] = Array.from(pointersRef.current.values())
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const zoomed = zoomAt(
          gesture.startView,
          gesture.cx,
          gesture.cy,
          distance / gesture.startDistance,
        )
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        viewRef.current = {
          ...zoomed,
          x: zoomed.x + (cx - gesture.cx),
          y: zoomed.y + (cy - gesture.cy),
        }
        requestFrame()
      }
    }

    const endPointer = (event: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
      const pointer = pointersRef.current.get(event.pointerId)
      pointersRef.current.delete(event.pointerId)
      canvasRef.current?.releasePointerCapture?.(event.pointerId)
      if (!pointer) return
      const gesture = gestureRef.current
      if (pointersRef.current.size === 0) gestureRef.current = { kind: 'none' }
      else if (gesture.kind === 'pinch') {
        // Un doigt reste : on repart d'un pan propre depuis sa position.
        const remaining = Array.from(pointersRef.current.values())[0]
        gestureRef.current = {
          kind: 'pan',
          startView: viewRef.current,
          startX: remaining.x,
          startY: remaining.y,
        }
      }
      if (cancelled) {
        draftRef.current = null
        requestFrame()
        return
      }

      if (!pointer.moved) {
        // Tap / clic : sélection (même verrouillé).
        const hit = hitNodeAt(pointer.x, pointer.y)
        if (hit) propsRef.current.onSelectNode(hit)
        else {
          const edge = hitEdgeAt(pointer.x, pointer.y)
          if (edge) propsRef.current.onSelectEdge(edge)
          else propsRef.current.onSelectNode(null)
        }
        return
      }
      if (gesture.kind === 'link') {
        const target = hitNodeAt(pointer.x, pointer.y)
        draftRef.current = null
        if (target && target !== gesture.fromId) propsRef.current.onLink(gesture.fromId, target)
        requestFrame()
      }
    }

    const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (propsRef.current.locked) return
      const point = localPoint(event)
      const hit = hitNodeAt(point.x, point.y)
      const layout = layoutRef.current
      const node = layout?.nodes.find((candidate) => candidate.id === hit)
      if (!layout || !node || !node.pinned) return
      // Double-clic sur un nœud épinglé : il est relâché et la simulation le reprend.
      node.pinned = false
      node.fx = undefined
      node.fy = undefined
      layout.simulation.alpha(0.3)
      persistPendingRef.current = true
      requestFrame()
    }

    return (
      <div ref={containerRef} className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={props.ariaLabel}
          data-testid="constellation-canvas"
          data-locked={props.locked}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: props.locked ? 'auto' : 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => endPointer(event, false)}
          onPointerCancel={(event) => endPointer(event, true)}
          onDoubleClick={onDoubleClick}
        />
      </div>
    )
  },
)
