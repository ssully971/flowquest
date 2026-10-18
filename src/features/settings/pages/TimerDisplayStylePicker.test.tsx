import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TimerDisplayStylePicker } from './TimerDisplayStylePicker'

describe('TimerDisplayStylePicker — grille des 6 styles d’affichage (lot 4)', () => {
  it('affiche les 6 styles, avec le style actuel marqué actif', () => {
    render(<TimerDisplayStylePicker value="gauge" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Classique' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Jauge' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Barre de progression' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Matrice de points' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Camembert' })).toBeInTheDocument()
  })

  it('appelle onChange avec le style choisi', () => {
    const onChange = vi.fn()
    render(<TimerDisplayStylePicker value="default" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Matrice de points' }))
    expect(onChange).toHaveBeenCalledWith('dot-matrix')
  })
})
