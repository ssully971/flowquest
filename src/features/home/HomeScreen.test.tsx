import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomeScreen } from './HomeScreen'

describe('HomeScreen — nom et citation agrandis, marges généreuses', () => {
  it('le nom « Flowquest » est affiché autour de 32-36px avec de grandes marges', () => {
    render(<HomeScreen />)
    const logo = screen.getByText('Flowquest')
    expect(logo.className).toContain('text-[32px]')
    expect(logo.className).toContain('sm:text-[36px]')
    expect(logo.parentElement?.className).toContain('sm:pt-16')
    expect(logo.parentElement?.className).toContain('sm:px-14')
  })

  it('la citation est affichée autour de 18-20px avec une largeur confortable', () => {
    render(<HomeScreen />)
    const quote = screen.getByText(/La vie est brève/)
    expect(quote.className).toContain('text-[18px]')
    expect(quote.className).toContain('sm:text-[20px]')
    expect(quote.closest('figure')?.className).toMatch(/max-w-(sm|md)/)
  })
})
