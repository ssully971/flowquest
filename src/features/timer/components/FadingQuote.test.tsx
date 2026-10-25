import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FadingQuote } from './FadingQuote'

const matchMediaMock = vi.fn()

beforeEach(() => {
  matchMediaMock.mockReset().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FadingQuote — LOT G1', () => {
  it('affiche la citation initiale', () => {
    render(<FadingQuote quote={{ text: 'Première', author: 'A', category: 'focus' }} />)
    expect(screen.getByText('“Première”')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('fond vers la nouvelle citation après ~300 ms', async () => {
    vi.useFakeTimers()
    const { rerender, container } = render(
      <FadingQuote quote={{ text: 'Première', author: 'A', category: 'focus' }} />,
    )

    rerender(<FadingQuote quote={{ text: 'Seconde', author: 'B', category: 'focus' }} />)

    // Toujours l'ancienne pendant le fondu, opacité à 0.
    expect(container.querySelector('figure')).toHaveStyle({ opacity: '0' })
    expect(screen.getByText('“Première”')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('“Seconde”')).toBeInTheDocument()
    expect(container.querySelector('figure')).toHaveStyle({ opacity: '1' })
  })

  it('bascule immédiatement sans fondu si prefers-reduced-motion', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const { rerender } = render(<FadingQuote quote={{ text: 'Première', author: 'A', category: 'focus' }} />)

    rerender(<FadingQuote quote={{ text: 'Seconde', author: 'B', category: 'focus' }} />)

    expect(screen.getByText('“Seconde”')).toBeInTheDocument()
  })
})
