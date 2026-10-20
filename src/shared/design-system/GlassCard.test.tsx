import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GlassCard } from './GlassCard'

describe('GlassCard — composant partagé « Liquid Glass » (LOT C1)', () => {
  it('applique la classe glass-panel et fusionne les classes supplémentaires', () => {
    render(<GlassCard className="rounded-3xl p-7">Contenu</GlassCard>)
    const card = screen.getByText('Contenu')
    expect(card.className).toContain('glass-panel')
    expect(card.className).toContain('rounded-3xl')
    expect(card.className).toContain('p-7')
  })

  it('fonctionne sans className fournie', () => {
    render(<GlassCard>Contenu</GlassCard>)
    expect(screen.getByText('Contenu').className.trim()).toBe('glass-panel')
  })

  it('transmet les props div (role, aria-label...) et la ref', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <GlassCard ref={ref} role="dialog" aria-label="Carte">
        Contenu
      </GlassCard>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Carte' })
    expect(ref.current).toBe(dialog)
  })
})
