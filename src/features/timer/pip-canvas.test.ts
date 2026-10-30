import { describe, expect, it, vi } from 'vitest'

import { PIP_CANVAS_HEIGHT, PIP_CANVAS_WIDTH, coverRect, drawPipFrame } from './pip-canvas'

function createMockContext() {
  const calls: string[] = []
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    calls,
    fillRect(...args: number[]) {
      calls.push(`fillRect(${args.join(',')})`)
    },
    fillText(text: string, x: number, y: number) {
      calls.push(`fillText(${text},${x},${y})`)
    },
  }
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] }
}

describe('drawPipFrame — contenu du PiP vidéo classique (§6.3 du cahier des charges)', () => {
  it('dessine le fond, le segment et le temps restant, sans ligne de tâche si absente', () => {
    const ctx = createMockContext()
    drawPipFrame(ctx, { segmentLabel: 'Focus', timeLabel: '24:59' })

    expect(ctx.calls[0]).toContain('fillRect')
    expect(ctx.calls.some((call) => call.includes('Focus'))).toBe(true)
    expect(ctx.calls.some((call) => call.includes('24:59'))).toBe(true)
    expect(ctx.calls).toHaveLength(3)
  })

  it('ajoute une ligne tâche, tronquée au-delà de 32 caractères', () => {
    const ctx = createMockContext()
    const longTitle = 'Une tâche avec un titre vraiment beaucoup trop long pour tenir'
    drawPipFrame(ctx, { segmentLabel: 'Focus', timeLabel: '24:59', taskLabel: longTitle })

    const taskCall = ctx.calls.find((call) => call.startsWith('fillText(Une tâche'))
    expect(taskCall).toBeDefined()
    expect(taskCall).toContain('…')
    expect(ctx.calls).toHaveLength(4)
  })

  it('n’ajoute pas de ligne tâche quand taskLabel est absent ou nul', () => {
    const ctx = createMockContext()
    drawPipFrame(ctx, { segmentLabel: 'Focus', timeLabel: '24:59', taskLabel: null })
    expect(ctx.calls).toHaveLength(3)
  })
})

describe('drawPipFrame — fond d’écran dans le PiP vidéo', () => {
  function createRecordingContext() {
    const calls: string[] = []
    const gradient = { addColorStop: vi.fn() }
    const ctx = {
      fillStyle: '' as string | CanvasGradient,
      shadowColor: '',
      shadowBlur: 0,
      globalAlpha: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      createLinearGradient: vi.fn(() => gradient),
      fillRect: (...args: number[]) => calls.push(`fillRect(${args.join(',')})`),
      drawImage: (...args: unknown[]) =>
        calls.push(`drawImage(${args.slice(1).join(',')})`),
      fillText: (text: string) => calls.push(`fillText(${text})`),
    }
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, gradient }
  }

  it('peint le dégradé, l’image recadrée en cover, puis un voile avant le texte', () => {
    const { ctx, calls, gradient } = createRecordingContext()
    drawPipFrame(ctx, {
      segmentLabel: 'Focus',
      timeLabel: '24:59',
      background: {
        image: {} as CanvasImageSource,
        imageWidth: 1920,
        imageHeight: 1080,
        anchor: 'center',
        colorFrom: '#111111',
        colorTo: '#222222',
      },
    })

    expect(gradient.addColorStop).toHaveBeenCalledWith(0, '#111111')
    expect(gradient.addColorStop).toHaveBeenCalledWith(1, '#222222')
    const order = calls.map((call) => call.split('(')[0])
    // dégradé → image → voile → texte
    expect(order.slice(0, 3)).toEqual(['fillRect', 'drawImage', 'fillRect'])
    expect(order.indexOf('fillText')).toBeGreaterThan(2)
    expect(ctx.fillStyle).toBeDefined()
  })

  it('sans image (fond en CSS) : dégradé équivalent + voile, aucun drawImage', () => {
    const { ctx, calls } = createRecordingContext()
    drawPipFrame(ctx, {
      segmentLabel: 'Pause',
      timeLabel: '04:00',
      background: { image: null, colorFrom: '#0c0719', colorTo: '#291d47' },
    })
    expect(calls.some((call) => call.startsWith('drawImage'))).toBe(false)
    expect(calls.filter((call) => call.startsWith('fillRect'))).toHaveLength(2)
  })

  it('sans fond : comportement historique (aplat uni, aucun voile ni dégradé)', () => {
    const { ctx, calls } = createRecordingContext()
    drawPipFrame(ctx, { segmentLabel: 'Focus', timeLabel: '24:59' })
    expect(calls.filter((call) => call.startsWith('fillRect'))).toHaveLength(1)
    expect(ctx.createLinearGradient).not.toHaveBeenCalled()
  })
})

describe('coverRect — recadrage « cover » sans déformation', () => {
  it('image large : recadre les côtés, centré', () => {
    const rect = coverRect(1920, 1080, PIP_CANVAS_WIDTH, PIP_CANVAS_HEIGHT)
    // Le rapport du rectangle source égale celui de la zone d'arrivée.
    expect(rect.sw / rect.sh).toBeCloseTo(PIP_CANVAS_WIDTH / PIP_CANVAS_HEIGHT, 5)
    expect(rect.sx).toBeGreaterThan(0)
    expect(rect.sy).toBeCloseTo(0, 5)
  })

  it('image haute : recadre le haut/bas selon l’ancrage', () => {
    const center = coverRect(1000, 3000, 240, 140, 'center')
    const top = coverRect(1000, 3000, 240, 140, 'top')
    const bottom = coverRect(1000, 3000, 240, 140, 'bottom')
    expect(top.sy).toBe(0)
    expect(bottom.sy).toBeCloseTo(3000 - top.sh, 5)
    expect(center.sy).toBeCloseTo((3000 - top.sh) / 2, 5)
    expect(top.sx).toBeCloseTo(0, 5)
  })
})
