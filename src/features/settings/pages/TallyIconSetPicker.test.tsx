import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TallyIconSetPicker } from './TallyIconSetPicker'

describe('TallyIconSetPicker — grille des 8 jeux d’icônes de sessions (lot 4)', () => {
  it('affiche les 8 jeux, avec le jeu actuel marqué actif', () => {
    render(<TallyIconSetPicker value="hearts" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Points' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Cœurs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Médical' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pilules' })).toBeInTheDocument()
  })

  it('appelle onChange avec le jeu choisi', () => {
    const onChange = vi.fn()
    render(<TallyIconSetPicker value="dots" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Médical' }))
    expect(onChange).toHaveBeenCalledWith('stethoscope')
  })
})
