import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TimerPath } from './TimerPath'

function getPaths(container: HTMLElement) {
  return Array.from(container.querySelectorAll('svg path')) as SVGPathElement[]
}

function getDot(container: HTMLElement) {
  return container.querySelector('div[style*="offset-path"]') as HTMLDivElement | null
}

describe('TimerPath — progression exacte (0 %, 50 %, 100 %), sans boîte autour', () => {
  it('à 0 %, le tracé accent est entièrement masqué (aucun segment visible avant le début)', () => {
    const { container } = render(<TimerPath progress={0} />)
    const [, accentPath] = getPaths(container)
    expect(accentPath.getAttribute('stroke-dashoffset')).toBe('100')
    const dot = getDot(container)
    expect(dot?.style.offsetDistance).toBe('0%')
  })

  it('à 50 %, le tracé accent est à mi-parcours exactement', () => {
    const { container } = render(<TimerPath progress={0.5} />)
    const [, accentPath] = getPaths(container)
    expect(accentPath.getAttribute('stroke-dashoffset')).toBe('50')
    const dot = getDot(container)
    expect(dot?.style.offsetDistance).toBe('50%')
  })

  it('à 100 %, le tracé accent est entièrement visible jusqu’au bout (barre complète)', () => {
    const { container } = render(<TimerPath progress={1} />)
    const [, accentPath] = getPaths(container)
    expect(accentPath.getAttribute('stroke-dashoffset')).toBe('0')
    const dot = getDot(container)
    expect(dot?.style.offsetDistance).toBe('100%')
  })

  it('ne dépasse jamais 100 % ni ne descend sous 0 % (valeurs hors bornes)', () => {
    const over = render(<TimerPath progress={1.4} />)
    expect(getPaths(over.container)[1].getAttribute('stroke-dashoffset')).toBe('0')
    const under = render(<TimerPath progress={-0.2} />)
    expect(getPaths(under.container)[1].getAttribute('stroke-dashoffset')).toBe('100')
  })

  it('aucune boîte/carte autour du tracé (pas de bordure, pas de fond de surface)', () => {
    const { container } = render(<TimerPath progress={0.3} />)
    const root = container.firstElementChild
    expect(root?.className).not.toContain('border')
    expect(root?.className).not.toContain('bg-[var(--surface)]')
    expect(root?.className).not.toContain('rounded-2xl')
  })

  it('est centré horizontalement (mx-auto, largeur contrainte)', () => {
    const { container } = render(<TimerPath progress={0.3} />)
    const root = container.firstElementChild
    expect(root?.className).toContain('mx-auto')
    expect(root?.className).toContain('w-full')
    expect(root?.className).toContain('max-w-md')
  })
})
