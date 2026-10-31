import { useEffect, useRef } from 'react'

import { onTasksChanged } from '@/features/tasks/task-events'
import { onSessionRecorded } from '@/features/stats/session-events'

import { onConstellationChanged } from './constellation-events'
import { loadConstellationSnapshot } from './constellation-snapshot'
import type { ConstellationSnapshot } from './constellation-snapshot'
import { displayRadius, drawConstellation, readPalette } from './draw-constellation'
import type { DrawEdge, DrawNode } from './draw-constellation'
import { boundsOf, fitView } from './view-transform'

/** Positions figées → nœuds dessinables (rendu statique, sans simulation). */
function toDrawData(snapshot: ConstellationSnapshot): { nodes: DrawNode[]; edges: DrawEdge[] } {
  const nodes: DrawNode[] = snapshot.graph.nodes.map((node) => ({
    id: node.id,
    x: snapshot.positions[node.id]?.x ?? 0,
    y: snapshot.positions[node.id]?.y ?? 0,
    r: node.radius,
    kind: node.kind,
    label: node.label,
    color: node.color,
    brightness: node.brightness,
    done: node.done,
    archived: node.archived,
    groupCount: node.groupCount,
  }))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges: DrawEdge[] = []
  for (const edge of snapshot.graph.edges) {
    const a = byId.get(edge.source)
    const b = byId.get(edge.target)
    if (!a || !b) continue
    edges.push({
      id: edge.id,
      kind: edge.kind,
      from: { x: a.x, y: a.y, r: a.r, kind: a.kind },
      to: { x: b.x, y: b.y, r: b.r, kind: b.kind },
    })
  }
  return { nodes, edges }
}

/**
 * Fond d'écran « Constellation » : la constellation de l'utilisateur, en lecture seule, calme —
 * positions figées, aucune simulation ni animation, une seule image dessinée (et redessinée
 * si la fenêtre change de taille ou si les données changent). Sans étiquettes, atténuée pour
 * rester lisible derrière l'horloge. Sans tâche : constellation décorative douce.
 */
export function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snapshotRef = useRef<ConstellationSnapshot | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    const paint = () => {
      const snapshot = snapshotRef.current
      const ctx = canvas.getContext('2d')
      if (!snapshot || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const { nodes, edges } = toDrawData(snapshot)
      const view = fitView(
        boundsOf(nodes.map((node) => ({ x: node.x, y: node.y, r: displayRadius(node) + 20 }))),
        rect.width,
        rect.height,
        24,
      )
      drawConstellation(ctx, {
        width: rect.width,
        height: rect.height,
        dpr,
        // La constellation remplit l'écran : zoom minimal pour ne jamais laisser de grand vide.
        view: { ...view, k: Math.max(view.k, 0.35) },
        nodes,
        edges,
        palette: readPalette(),
        labels: 'never',
      })
    }

    const load = () => {
      void loadConstellationSnapshot().then((snapshot) => {
        if (cancelled) return
        snapshotRef.current = snapshot
        paint()
      })
    }
    load()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint)
    observer?.observe(canvas)
    const unsubscribers = [
      onTasksChanged(load),
      onConstellationChanged(load),
      onSessionRecorded(load),
    ]
    return () => {
      cancelled = true
      observer?.disconnect()
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      data-testid="constellation-background"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--horizon)' }}
    >
      <canvas ref={canvasRef} className="h-full w-full" style={{ opacity: 0.5 }} />
    </div>
  )
}
