import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeepFocusIndicator } from './DeepFocusIndicator'

describe('DeepFocusIndicator — LOT G2', () => {
  it('affiche un indicateur purement informatif, sans aucun élément cliquable', () => {
    render(<DeepFocusIndicator />)

    const indicator = screen.getByRole('status', { name: 'Deep Focus actif' })
    expect(indicator).toBeInTheDocument()
    expect(indicator.tagName).not.toBe('BUTTON')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
