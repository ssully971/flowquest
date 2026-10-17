import { describe, expect, it } from 'vitest'

import { drawPipFrame } from './pip-canvas'

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
