import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsToggleRow } from './SettingsToggleRow'

describe('SettingsToggleRow — carte réglage avec interrupteur (lot 2)', () => {
  it('affiche le libellé et l’interrupteur sans indice', () => {
    render(<SettingsToggleRow label="Afficher les secondes" checked={false} onToggle={vi.fn()} />)
    expect(screen.getByText('Afficher les secondes')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Afficher les secondes' })).toBeInTheDocument()
  })

  it('affiche l’indice quand il est fourni', () => {
    render(
      <SettingsToggleRow
        label="Horloge « flip »"
        hint="Anime les chiffres qui changent."
        checked
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('Anime les chiffres qui changent.')).toBeInTheDocument()
  })

  it('toute la ligne est cliquable, un seul élément interactif (LOT D, zone tactile ≥44px)', () => {
    const onToggle = vi.fn()
    render(<SettingsToggleRow label="Mode épuré" checked={false} onToggle={onToggle} />)

    expect(screen.getAllByRole('switch')).toHaveLength(1)
    fireEvent.click(screen.getByRole('switch', { name: 'Mode épuré' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
