import { ZoomIn } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { GlassCard, ModalOverlay } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { clampPan, computeCropRect } from '../process-avatar'
import type { AvatarCropConfirmTransform } from '../useAvatarUpload'

const VIEWPORT_SIZE = 240
const MIN_ZOOM = 1
const MAX_ZOOM = 3

interface AvatarCropperProps {
  bitmap: ImageBitmap
  isUploading: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (transform: AvatarCropConfirmTransform) => void
}

/**
 * Écran de recadrage carré (LOT F1, §1) : zoom (curseur) et déplacement (glisser), rendus
 * sur un canvas plutôt qu'un <img> + transform CSS — la prévisualisation utilise
 * exactement le même calcul (computeCropRect) que l'export final, donc ce que
 * l'utilisateur voit est garanti être ce qui sera enregistré.
 */
export function AvatarCropper({
  bitmap,
  isUploading,
  error,
  onCancel,
  onConfirm,
}: AvatarCropperProps) {
  const s = strings.avatar.cropper
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = computeCropRect({
      naturalWidth: bitmap.width,
      naturalHeight: bitmap.height,
      viewportSize: VIEWPORT_SIZE,
      zoom,
      panX: pan.x,
      panY: pan.y,
    })
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE)
    ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE)
  }, [bitmap, zoom, pan])

  const reclamp = (nextZoom: number, nextPanX: number, nextPanY: number) => {
    const clamped = clampPan({
      naturalWidth: bitmap.width,
      naturalHeight: bitmap.height,
      viewportSize: VIEWPORT_SIZE,
      zoom: nextZoom,
      panX: nextPanX,
      panY: nextPanY,
    })
    setPan({ x: clamped.panX, y: clamped.panY })
  }

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom)
    reclamp(nextZoom, pan.x, pan.y)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    }
  }
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    reclamp(zoom, dragRef.current.originX + dx, dragRef.current.originY + dy)
  }
  const handlePointerUp = () => {
    dragRef.current = null
  }

  return (
    <ModalOverlay className="z-50" blur onBackdropClick={isUploading ? undefined : onCancel}>
      <GlassCard
        role="dialog"
        aria-label={s.title}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-[28px] p-6"
      >
        <h2 className="text-sm font-semibold text-[var(--text)]">{s.title}</h2>

        <canvas
          ref={canvasRef}
          width={VIEWPORT_SIZE}
          height={VIEWPORT_SIZE}
          role="img"
          aria-label={s.previewLabel}
          className="touch-none select-none rounded-full border border-[var(--line)]"
          style={{
            width: VIEWPORT_SIZE,
            height: VIEWPORT_SIZE,
            cursor: isUploading ? 'default' : 'grab',
          }}
          onPointerDown={isUploading ? undefined : handlePointerDown}
          onPointerMove={isUploading ? undefined : handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        <label className="flex w-full items-center gap-3 text-[var(--muted)]">
          <ZoomIn size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            disabled={isUploading}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            aria-label={s.zoomLabel}
            className="h-2 flex-1 accent-[var(--accent)]"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-[#E5484D]">
            {error}
          </p>
        ) : null}

        <div className="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="h-10 rounded-xl border border-[var(--line)] px-4 text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:opacity-40"
          >
            {s.cancel}
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({ viewportSize: VIEWPORT_SIZE, zoom, panX: pan.x, panY: pan.y })
            }
            disabled={isUploading}
            className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
          >
            {isUploading ? s.saving : s.confirm}
          </button>
        </div>
      </GlassCard>
    </ModalOverlay>
  )
}
