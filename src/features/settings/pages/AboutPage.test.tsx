import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AboutPage } from './AboutPage'

describe('AboutPage (lot I1, §4)', () => {
  it('affiche la version, les liens légaux et les crédits (photos + sons)', () => {
    render(<AboutPage onOpenChangelog={vi.fn()} />)

    expect(screen.getByText('Version')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conditions d’utilisation' })).toHaveAttribute(
      'href',
      '/conditions',
    )
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute(
      'href',
      '/confidentialite',
    )
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/mentions-legales',
    )
    // Crédits dérivés du registre des fonds (jamais dupliqués en dur) : au moins les
    // fonds crédités connus doivent apparaître.
    expect(screen.getByText('Pirogue')).toBeInTheDocument()
    expect(screen.getByText('Johannes Plenio · Pexels')).toBeInTheDocument()
    expect(screen.getByText('Lac bleu')).toBeInTheDocument()
    expect(screen.getAllByText('aalmeidah · Pixabay').length).toBeGreaterThan(0)
    // Sons : marqués à compléter, jamais inventés (voir docs/CREDITS.md).
    expect(screen.getAllByText('À compléter').length).toBe(4)
  })

  it('ouvre le journal des changements au clic', async () => {
    const onOpenChangelog = vi.fn()
    render(<AboutPage onOpenChangelog={onOpenChangelog} />)
    screen.getByRole('button', { name: 'Journal des changements' }).click()
    expect(onOpenChangelog).toHaveBeenCalled()
  })
})
