import { useEffect, useRef } from 'react'

import type { Graph } from './build-graph'
import type { CanvasViewState } from './ConstellationCanvas'
import type { Positions } from './force-layout'
import { minimapToWorld, minimapTransform, viewportWorldRect, worldToMinimap } from './minimap'
import { strings } from '@/shared/i18n'
import { boundsOf } from './view-transform'

const WIDTH = 156
const HEIGHT = 100

interface ConstellationMinimapProps {
  graph: Graph
  positions: Positions
  view: CanvasViewState | null
  /** Clic ou glisser dans la mini-carte : centre la vue sur ce point du monde. */
  onNavigate: (worldX: number, worldY: number) => void
}

/** Mini-carte 156 × 100 : un point par nœud aux couleurs des piliers, rectangle de la vue. */
export function ConstellationMinimap({
  graph,
  positions,
  view,
  onNavigate,
}: ConstellationMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = WIDTH * dpr
    canvas.height = HEIGHT * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, WIDTH, HEIGHT)

    const points = graph.nodes
      .map((node) => ({ node, position: positions[node.id] }))
      .filter((entry) => entry.position)
    const bounds = boundsOf(
      points.map((entry) => ({ x: entry.position.x, y: entry.position.y, r: 4 })),
    )
    const transform = minimapTransform(bounds, WIDTH, HEIGHT)
    for (const { node, position } of points) {
      const p = worldToMinimap(transform, position.x, position.y)
      ctx.fillStyle = node.color
      ctx.globalAlpha = node.archived ? 0.45 : 1
      const size = node.kind === 'pillar' ? 3 : 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (view && view.width > 0) {
      const rect = viewportWorldRect(view, view.width, view.height)
      const a = worldToMinimap(transform, rect.x, rect.y)
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue('--cst-label-strong').trim() ||
        '#fff'
      ctx.lineWidth = 1
      ctx.strokeRect(a.x, a.y, rect.w * transform.scale, rect.h * transform.scale)
    }
  }, [graph, positions, view])

  const navigate = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const points = graph.nodes.map((node) => positions[node.id]).filter(Boolean)
    const transform = minimapTransform(
      boundsOf(points.map((p) => ({ x: p.x, y: p.y, r: 4 }))),
      WIDTH,
      HEIGHT,
    )
    const world = minimapToWorld(transform, event.clientX - rect.left, event.clientY - rect.top)
    onNavigate(world.x, world.y)
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={strings.constellation.minimap.label}
      data-testid="constellation-minimap"
      width={WIDTH}
      height={HEIGHT}
      style={{ width: WIDTH, height: HEIGHT, touchAction: 'none' }}
      className="cursor-pointer rounded-xl border border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] backdrop-blur-md"
      onPointerDown={(event) => {
        draggingRef.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
        navigate(event)
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) navigate(event)
      }}
      onPointerUp={() => {
        draggingRef.current = false
      }}
      onPointerCancel={() => {
        draggingRef.current = false
      }}
    />
  )
}
