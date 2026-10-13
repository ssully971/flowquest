import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TimerPath } from './TimerPath'

describe('TimerPath — vague en canvas dans une boîte compacte', () => {
  it('rend un canvas de dessin, marqué décoratif (aria-hidden)', () => {
    const { container } = render(<TimerPath progress={0.4} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('utilise les jetons de couleur de l’identité (--contour, --surface, --glow), pas de couleurs fixes', () => {
    const { container } = render(<TimerPath progress={0.4} />)
    const box = container.firstElementChild
    expect(box?.className).toContain('border-[var(--contour)]')
    expect(box?.className).toContain('bg-[var(--surface)]')
    expect(box?.className).toContain('shadow-[0_10px_24px_var(--glow)]')
  })

  it('est centré et de largeur compacte contrainte (mx-auto, max-w-xs)', () => {
    const { container } = render(<TimerPath progress={0.4} />)
    const box = container.firstElementChild
    expect(box?.className).toContain('mx-auto')
    expect(box?.className).toContain('max-w-xs')
  })

  it("n'explose pas quand le canvas 2D n'est pas disponible (environnement de test)", () => {
    expect(() => render(<TimerPath progress={1} />)).not.toThrow()
  })
})
