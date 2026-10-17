import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_QUOTES_SETTINGS } from '@/features/home/quotes-settings'

import { QuotesPage } from './QuotesPage'

describe('QuotesPage — affichage, rotation et catégorie des citations', () => {
  it('affiche un aperçu de citation', () => {
    render(<QuotesPage settings={DEFAULT_QUOTES_SETTINGS} onChange={vi.fn()} />)
    expect(screen.getByText('Aperçu')).toBeInTheDocument()
    expect(document.querySelector('blockquote')).not.toBeNull()
  })

  it('bascule afficher sur l’accueil et en mode Focus', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuotesPage settings={DEFAULT_QUOTES_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Afficher sur l’accueil' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_QUOTES_SETTINGS, showOnHome: false })

    await user.click(screen.getByRole('switch', { name: 'Afficher en mode Focus' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_QUOTES_SETTINGS, showOnFocus: true })
  })

  it('change la rotation', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuotesPage settings={DEFAULT_QUOTES_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'À chaque chargement' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_QUOTES_SETTINGS, rotation: 'everyLoad' })
  })

  it('change la catégorie', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuotesPage settings={DEFAULT_QUOTES_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Médecine' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_QUOTES_SETTINGS, category: 'medicine' })
  })
})
