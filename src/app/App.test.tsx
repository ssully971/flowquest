import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { App } from './App'

describe('App', () => {
  it('affiche le nom de l’application', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )
    expect(screen.getByText('Flowquest')).toBeInTheDocument()
  })
})
