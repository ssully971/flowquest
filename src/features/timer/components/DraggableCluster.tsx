import { GripVertical } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'

import {
  DEFAULT_AMBIENT_POSITIONS,
  movePosition,
  positionFromRects,
  positionKeyForWidth,
  stepPosition,
} from '@/features/home/clock-position'
import type {
  AmbientClockPositions,
  ClockPosition,
  PositionKey,
} from '@/features/home/clock-position'
import { strings } from '@/shared/i18n'

interface DraggableClusterProps {
  positions: AmbientClockPositions | undefined
  /** `null` remet l'emplacement par défaut pour cette taille d'écran. */
  onChange: (key: PositionKey, position: ClockPosition | null) => void
  /** La carte d'horloge reçoit la poignée à placer dans sa mise en page. */
  children: (grip: ReactNode) => ReactNode
}

/** Emplacements par défaut (parts de l'espace libre) : haut-droite sur grand écran, haut-centre sur mobile. */
const DEFAULT_POSITION: Record<PositionKey, ClockPosition> = {
  wide: { x: 1, y: 0 },
  compact: { x: 0.5, y: 0 },
}

/**
 * Bloc d'horloge du mode Ambiant, DÉPLAÇABLE (LOT 2) : à la souris et au doigt (Pointer Events,
 * `touch-action: none` sur la seule poignée, pour ne gêner aucun geste de l'écran), au clavier
 * (flèches sur la poignée, Maj = grand pas), remis à sa place par double-clic / double-tap ou Début.
 * Contenu dans l'écran : la région de déplacement exclut les zones de sécurité et la barre du bas, et la
 * position est une part de l'espace libre — jamais un pixel, donc toujours à l'écran.
 */
export function DraggableCluster({ positions, onChange, children }: DraggableClusterProps) {
  const [key, setKey] = useState<PositionKey>(() => positionKeyForWidth(window.innerWidth))
  const [dragPosition, setDragPosition] = useState<ClockPosition | null>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const clusterRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    start: ClockPosition
    freeWidth: number
    freeHeight: number
  } | null>(null)

  useEffect(() => {
    const onResize = () => setKey(positionKeyForWidth(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const stored = (positions ?? DEFAULT_AMBIENT_POSITIONS)[key]
  const position = dragPosition ?? stored ?? DEFAULT_POSITION[key]

  /** Position réellement occupée à l'écran (utile quand on part de l'emplacement par défaut). */
  const measureCurrent = useCallback((): {
    position: ClockPosition
    freeW: number
    freeH: number
  } => {
    const region = regionRef.current?.getBoundingClientRect()
    const cluster = clusterRef.current?.getBoundingClientRect()
    if (!region || !cluster) return { position, freeW: 0, freeH: 0 }
    return {
      position: positionFromRects(region, cluster),
      freeW: region.width - cluster.width,
      freeH: region.height - cluster.height,
    }
  }, [position])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const measured = measureCurrent()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: measured.position,
      freeWidth: measured.freeW,
      freeHeight: measured.freeH,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragPosition(measured.position)
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setDragPosition(
      movePosition(
        drag.start,
        event.clientX - drag.startX,
        event.clientY - drag.startY,
        drag.freeWidth,
        drag.freeHeight,
      ),
    )
  }

  const endDrag = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const final = commit
      ? movePosition(
          drag.start,
          event.clientX - drag.startX,
          event.clientY - drag.startY,
          drag.freeWidth,
          drag.freeHeight,
        )
      : null
    setDragPosition(null)
    // Un simple clic (aucun déplacement) ne change rien : on ne mémorise pas une position identique.
    if (final && (final.x !== drag.start.x || final.y !== drag.start.y)) onChange(key, final)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') {
      event.preventDefault()
      event.stopPropagation()
      onChange(key, null)
      return
    }
    const next = stepPosition(measureCurrent().position, event.key, event.shiftKey)
    if (!next) return
    // Les flèches ne doivent pas déclencher en plus les raccourcis du minuteur (→ = phase suivante).
    event.preventDefault()
    event.stopPropagation()
    onChange(key, next)
  }

  const grip = (
    <>
      <button
        type="button"
        aria-label={strings.ambient.moveClock}
        aria-describedby="ambient-clock-grip-hint"
        title={strings.ambient.moveClock}
        data-testid="ambient-clock-grip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endDrag(event, true)}
        onPointerCancel={(event) => endDrag(event, false)}
        onDoubleClick={() => onChange(key, null)}
        onKeyDown={onKeyDown}
        className="-ml-1 inline-flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[var(--glass-icon)] transition-colors duration-200 hover:text-[var(--glass-icon-hover)] active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <GripVertical size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <span id="ambient-clock-grip-hint" className="sr-only">
        {strings.ambient.moveClockHint}
      </span>
    </>
  )

  return (
    <div
      ref={regionRef}
      data-testid="ambient-clock-region"
      className="pointer-events-none absolute bottom-24 left-4 right-4 top-[max(2rem,env(safe-area-inset-top))] sm:right-14 sm:top-[max(4rem,env(safe-area-inset-top))]"
    >
      <div
        ref={clusterRef}
        data-testid="ambient-clock-cluster"
        className="ambient-clock-cluster pointer-events-auto absolute flex w-max max-w-full flex-col items-center gap-2 sm:items-end"
        style={{
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
          transform: `translate(-${position.x * 100}%, -${position.y * 100}%)`,
        }}
      >
        {children(grip)}
      </div>
    </div>
  )
}
