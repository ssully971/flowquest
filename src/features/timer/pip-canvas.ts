export const PIP_CANVAS_WIDTH = 240
export const PIP_CANVAS_HEIGHT = 140

/** Fond dessiné derrière le minuteur : image (déjà chargée) recadrée en « cover », ou, à défaut,
 * dégradé de deux couleurs déjà résolues. */
export interface PipFrameBackground {
  image: CanvasImageSource | null
  /** Dimensions naturelles de l'image (pour le recadrage). */
  imageWidth?: number
  imageHeight?: number
  /** `top` | `center` | `bottom` : point d'ancrage vertical du recadrage. */
  anchor?: 'top' | 'center' | 'bottom'
  colorFrom: string
  colorTo: string
}

export interface PipFrameContent {
  segmentLabel: string
  timeLabel: string
  taskLabel?: string | null
  background?: PipFrameBackground | null
}

/** Voile posé sur le fond : garantit le contraste du texte clair sur n'importe quelle image. */
const PIP_VEIL = 'rgba(8, 4, 20, 0.5)'

/** Rectangle source d'un recadrage « cover » : remplit toute la zone sans déformer l'image. */
export function coverRect(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
  anchor: 'top' | 'center' | 'bottom' = 'center',
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(width / imageWidth, height / imageHeight)
  const sw = width / scale
  const sh = height / scale
  const sx = (imageWidth - sw) / 2
  const free = imageHeight - sh
  const sy = anchor === 'top' ? 0 : anchor === 'bottom' ? free : free / 2
  return { sx, sy, sw, sh }
}

function drawBackground(ctx: CanvasRenderingContext2D, background: PipFrameBackground): void {
  const gradient = ctx.createLinearGradient(0, 0, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)
  gradient.addColorStop(0, background.colorFrom)
  gradient.addColorStop(1, background.colorTo)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)

  if (background.image && background.imageWidth && background.imageHeight) {
    const { sx, sy, sw, sh } = coverRect(
      background.imageWidth,
      background.imageHeight,
      PIP_CANVAS_WIDTH,
      PIP_CANVAS_HEIGHT,
      background.anchor,
    )
    ctx.drawImage(background.image, sx, sy, sw, sh, 0, 0, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)
  }
  ctx.fillStyle = PIP_VEIL
  ctx.fillRect(0, 0, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)
}

const MAX_TASK_LABEL_LENGTH = 32

/** Dessine l'équivalent du minuteur compact affiché en PiP, pour le mode vidéo
 * classique (§6.3 : « à défaut, une fenêtre vidéo/canvas en PiP classique »). Le mode
 * Document Picture-in-Picture n'a pas besoin de ça : il rend du vrai DOM via un portail
 * React (voir FocusScreen.tsx). */
export function drawPipFrame(ctx: CanvasRenderingContext2D, content: PipFrameContent): void {
  if (content.background) {
    drawBackground(ctx, content.background)
  } else {
    ctx.fillStyle = '#0c0719'
    ctx.fillRect(0, 0, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Léger ombrage du texte pour rester lisible quel que soit le fond.
  if (content.background) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 6
  }

  ctx.fillStyle = '#f2ecfc'
  ctx.globalAlpha = 0.7
  ctx.font = '14px sans-serif'
  ctx.fillText(content.segmentLabel, PIP_CANVAS_WIDTH / 2, 28)
  ctx.globalAlpha = 1

  ctx.font = 'bold 40px sans-serif'
  ctx.fillText(content.timeLabel, PIP_CANVAS_WIDTH / 2, content.taskLabel ? 68 : 76)

  if (content.taskLabel) {
    ctx.globalAlpha = 0.6
    ctx.font = '12px sans-serif'
    const truncated =
      content.taskLabel.length > MAX_TASK_LABEL_LENGTH
        ? `${content.taskLabel.slice(0, MAX_TASK_LABEL_LENGTH - 1)}…`
        : content.taskLabel
    ctx.fillText(truncated, PIP_CANVAS_WIDTH / 2, 108)
    ctx.globalAlpha = 1
  }
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}
