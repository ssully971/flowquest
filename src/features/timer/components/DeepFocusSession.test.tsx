import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DeepFocusSession } from './DeepFocusSession'

function renderSession(overrides: Partial<Parameters<typeof DeepFocusSession>[0]> = {}) {
  return render(
    <DeepFocusSession
      theme="dark"
      displayLabel="24:59"
      displayStyle="default"
      progress={0.2}
      clockSize="normal"
      clockStyle="default-bold"
      status="running"
      onPrimary={vi.fn()}
      onEndSession={vi.fn()}
      {...overrides}
    />,
  )
}

describe('DeepFocusSession — mise en page ultra-minimale (lot 3 bis, §6)', () => {
  it('fond noir pur et horloge blanche en thème sombre', () => {
    const { container } = renderSession({ theme: 'dark' })
    const root = container.firstElementChild as HTMLElement
    expect(root.style.background).toBe('rgb(0, 0, 0)')
    expect(root.style.color).toBe('rgb(255, 255, 255)')
  })

  it('fond blanc pur et horloge noire en thème clair', () => {
    const { container } = renderSession({ theme: 'light' })
    const root = container.firstElementChild as HTMLElement
    expect(root.style.background).toBe('rgb(255, 255, 255)')
    expect(root.style.color).toBe('rgb(0, 0, 0)')
  })

  it('ne montre que le temps, un bouton pause et un bouton terminer', () => {
    renderSession()
    expect(screen.getByRole('timer')).toHaveTextContent('24:59')
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeInTheDocument()
  })

  it('redéfinit --accent localement : le séparateur « : » reste monochrome, jamais la couleur de marque', () => {
    const { container } = renderSession({ theme: 'dark' })
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--accent')).toBe('#ffffff')
  })

  it('propose Reprendre plutôt que Mettre en pause une fois en pause', () => {
    renderSession({ status: 'paused' })
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
  })

  it('appelle onPrimary et onEndSession au clic', () => {
    const onPrimary = vi.fn()
    const onEndSession = vi.fn()
    renderSession({ onPrimary, onEndSession })

    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    expect(onPrimary).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(onEndSession).toHaveBeenCalledTimes(1)
  })
})

describe('DeepFocusSession — estompage des commandes après inactivité (lot 3 bis, §6)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('les boutons sont visibles au départ, puis s’estompent après 3 s d’inactivité', () => {
    renderSession()
    const controlsWrapper = screen.getByRole('button', { name: 'Mettre en pause' })
      .parentElement as HTMLElement
    expect(controlsWrapper.style.opacity).toBe('1')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(controlsWrapper.style.opacity).toBe('0')
  })

  it('réapparaissent au moindre geste (pointeur ou clavier)', () => {
    renderSession()
    const controlsWrapper = screen.getByRole('button', { name: 'Mettre en pause' })
      .parentElement as HTMLElement

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(controlsWrapper.style.opacity).toBe('0')

    fireEvent.pointerDown(window)
    expect(controlsWrapper.style.opacity).toBe('1')
  })
})
