import { useEffect, useMemo, useRef, useState } from 'react'

import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { strings } from '@/shared/i18n'

import type { GalaxyData, GalaxyStar } from '../build-galaxy-data'
import { deterministicUnit } from '../galaxy-hash'
import { formatGalaxyDate, formatGalaxyDuration } from '../galaxy-format'

interface GalaxyCanvasProps {
  data: GalaxyData
}

const PADDING_PX = 12
const HIT_TOLERANCE_PX = 6
const LINE_ALPHA = 0.3
const CLUSTER_RING_ALPHA = 0.6
/** Part des étoiles qui scintillent très légèrement (jamais toutes — ça distrairait). */
const TWINKLE_SHARE = 0.15
const TWINKLE_INTERVAL_MS = 400

interface Size {
  width: number
  height: number
}

function toPixel(point: { x: number; y: number }, size: Size): { px: number; py: number } {
  const innerWidth = Math.max(1, size.width - PADDING_PX * 2)
  const innerHeight = Math.max(1, size.height - PADDING_PX * 2)
  return {
    px: PADDING_PX + point.x * innerWidth,
    py: PADDING_PX + point.y * innerHeight,
  }
}

interface ThemeColors {
  /** Couleur des liaisons du même jour — l'accent de marque, pour rester visible et
   * cohérent dans les deux thèmes (contrairement à un blanc translucide fixe, invisible
   * sur fond clair). */
  line: string
  /** Couleur de l'anneau des étoiles agrégées — le texte principal du thème, garanti
   * contrasté sur fond clair comme sombre. */
  clusterRing: string
}

function readThemeColors(element: HTMLElement): ThemeColors {
  const computed = getComputedStyle(element)
  return {
    line: computed.getPropertyValue('--accent').trim() || '#7c3aed',
    clusterRing: computed.getPropertyValue('--panel-text').trim() || '#1a1025',
  }
}

function drawBaseLayer(
  canvas: HTMLCanvasElement,
  data: GalaxyData,
  size: Size,
  dpr: number,
  theme: ThemeColors,
): number {
  const start = performance.now()
  canvas.width = Math.max(1, Math.round(size.width * dpr))
  canvas.height = Math.max(1, Math.round(size.height * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, size.width, size.height)

  ctx.strokeStyle = theme.line
  ctx.lineWidth = 1
  ctx.globalAlpha = LINE_ALPHA
  for (const line of data.lines) {
    const p1 = toPixel({ x: line.x1, y: line.y1 }, size)
    const p2 = toPixel({ x: line.x2, y: line.y2 }, size)
    ctx.beginPath()
    ctx.moveTo(p1.px, p1.py)
    ctx.lineTo(p2.px, p2.py)
    ctx.stroke()
  }

  for (const star of data.stars) {
    const { px, py } = toPixel(star, size)
    ctx.beginPath()
    ctx.fillStyle = star.color
    ctx.globalAlpha = 1
    ctx.arc(px, py, star.radius, 0, Math.PI * 2)
    ctx.fill()
    if (star.isCluster) {
      ctx.strokeStyle = theme.clusterRing
      ctx.globalAlpha = CLUSTER_RING_ALPHA
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(px, py, star.radius + 2.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  return performance.now() - start
}

/**
 * Rendu canvas 2D de la Galaxie (LOT G4) : la couche de base (étoiles + liaisons) est
 * dessinée une seule fois dans un canvas hors écran, mise en cache, et seulement
 * redessinée si `data` ou la taille change — jamais de boucle d'animation pour l'affichage
 * normal. Le scintillement (léger, une poignée d'étoiles) tourne séparément, à très basse
 * fréquence, coupé par prefers-reduced-motion et dès que l'onglet passe en arrière-plan.
 */
export function GalaxyCanvas({ data }: GalaxyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [hovered, setHovered] = useState<{ star: GalaxyStar; x: number; y: number } | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const s = strings.settings.galaxy

  useEffect(() => {
    const container = containerRef.current
    // jsdom (tests) n'implémente pas ResizeObserver — comme usePrefersReducedMotion
    // (LOT G1) pour matchMedia, on s'en passe silencieusement plutôt que de planter.
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const twinklingStars = useMemo(
    () => data.stars.filter((star) => deterministicUnit(`${star.id}:twinkle`) < TWINKLE_SHARE),
    [data.stars],
  )

  // Couche de base : une seule passe, mise en cache dans un canvas hors écran, jamais
  // redessinée en dehors d'un vrai changement de données ou de taille. La couleur est
  // relue depuis les variables CSS à chaque passe (readThemeColors), donc un nouveau
  // montage (changement d'onglet) capte toujours le thème courant, même si cet effet ne
  // redessine pas tout seul en cas de bascule de thème pendant que la vue reste ouverte.
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return
    const container = containerRef.current
    if (!container) return
    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas')
    const dpr = window.devicePixelRatio || 1
    const theme = readThemeColors(container)
    const renderMs = drawBaseLayer(offscreenRef.current, data, size, dpr, theme)
    if (import.meta.env.DEV && data.stars.length >= 500) {
      console.info(
        `[Galaxie] ${data.stars.length} étoiles rendues en ${renderMs.toFixed(1)} ms (devicePixelRatio ${dpr}).`,
      )
    }

    const visible = canvasRef.current
    if (!visible) return
    visible.width = offscreenRef.current.width
    visible.height = offscreenRef.current.height
    visible.style.width = `${size.width}px`
    visible.style.height = `${size.height}px`
    const ctx = visible.getContext('2d')
    ctx?.drawImage(offscreenRef.current, 0, 0)
  }, [data, size])

  // Scintillement très léger (LOT G4) : jamais une boucle requestAnimationFrame 60 fps,
  // un intervalle espacé, coupé par prefers-reduced-motion et pendant que l'onglet est en
  // arrière-plan (pas de travail inutile pour un effet invisible).
  useEffect(() => {
    if (prefersReducedMotion || twinklingStars.length === 0) return
    if (size.width === 0 || size.height === 0) return

    let intervalId: number | null = null

    const redrawWithTwinkle = () => {
      const visible = canvasRef.current
      const offscreen = offscreenRef.current
      if (!visible || !offscreen) return
      const ctx = visible.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.clearRect(0, 0, visible.width, visible.height)
      ctx.drawImage(offscreen, 0, 0)
      ctx.save()
      ctx.scale(dpr, dpr)
      const now = performance.now()
      for (const star of twinklingStars) {
        const phase = deterministicUnit(`${star.id}:phase`) * Math.PI * 2
        const alpha = 0.45 + 0.4 * Math.sin(now / 900 + phase)
        const { px, py } = toPixel(star, size)
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
        ctx.fillStyle = star.color
        ctx.beginPath()
        ctx.arc(px, py, star.radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const start = () => {
      if (document.visibilityState !== 'visible') return
      if (intervalId !== null) return
      intervalId = window.setInterval(redrawWithTwinkle, TWINKLE_INTERVAL_MS)
    }
    const stop = () => {
      if (intervalId === null) return
      window.clearInterval(intervalId)
      intervalId = null
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [twinklingStars, size, prefersReducedMotion])

  const hitTest = (clientX: number, clientY: number): GalaxyStar | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    let closest: GalaxyStar | null = null
    let closestDistance = Infinity
    for (const star of data.stars) {
      const { px, py } = toPixel(star, size)
      const distance = Math.hypot(px - x, py - y)
      if (distance <= star.radius + HIT_TOLERANCE_PX && distance < closestDistance) {
        closest = star
        closestDistance = distance
      }
    }
    return closest
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') return
    const star = hitTest(event.clientX, event.clientY)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!star || !rect) {
      setHovered(null)
      return
    }
    setHovered({ star, x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  const handlePointerLeave = () => setHovered(null)

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== 'touch') return
    const star = hitTest(event.clientX, event.clientY)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!star || !rect) {
      setHovered(null)
      return
    }
    setHovered((previous) =>
      previous?.star.id === star.id
        ? null
        : { star, x: event.clientX - rect.left, y: event.clientY - rect.top },
    )
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={s.chartLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
        className="block h-full w-full touch-none"
      />
      {hovered ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-max max-w-[200px] -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1.5 text-xs text-[var(--panel-text)] shadow-lg"
          style={{ left: hovered.x, top: Math.max(0, hovered.y - 8) }}
        >
          <p className="font-medium">{formatGalaxyDate(hovered.star.date)}</p>
          <p className="text-[var(--panel-muted)]">
            {formatGalaxyDuration(hovered.star.durationSeconds)}
            {hovered.star.pillarName ? ` · ${hovered.star.pillarName}` : ` · ${s.noPillar}`}
          </p>
          {hovered.star.isCluster ? (
            <p className="text-[var(--panel-muted)]">
              {hovered.star.sessionCount} {s.sessionsGrouped}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
