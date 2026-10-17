export const PIP_CANVAS_WIDTH = 240
export const PIP_CANVAS_HEIGHT = 140

export interface PipFrameContent {
  segmentLabel: string
  timeLabel: string
  taskLabel?: string | null
}

const MAX_TASK_LABEL_LENGTH = 32

/** Dessine l'équivalent du minuteur compact affiché en PiP, pour le mode vidéo
 * classique (§6.3 : « à défaut, une fenêtre vidéo/canvas en PiP classique »). Le mode
 * Document Picture-in-Picture n'a pas besoin de ça : il rend du vrai DOM via un portail
 * React (voir FocusScreen.tsx). */
export function drawPipFrame(ctx: CanvasRenderingContext2D, content: PipFrameContent): void {
  ctx.fillStyle = '#120c1e'
  ctx.fillRect(0, 0, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

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
}
