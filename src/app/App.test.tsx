import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('affiche l’écran Focus une fois le minuteur restauré', async () => {
    render(<App />)
    expect(await screen.findByText('Sur quoi te concentres-tu ?')).toBeInTheDocument()
  })
})
