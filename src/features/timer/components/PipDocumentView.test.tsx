import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PipDocumentView } from './PipDocumentView'

const BACKGROUND = {
  imageSrc: '/backgrounds/x.webp',
  position: 'center top',
  colorFrom: '#000',
  colorTo: '#111',
}

function renderView(props: Partial<Parameters<typeof PipDocumentView>[0]> = {}) {
  const handlers = { onPrimary: vi.fn(), onEnd: vi.fn() }
  render(
    <PipDocumentView
      segmentLabel="Focus"
      timeLabel="24:59"
      background={BACKGROUND}
      status="running"
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('PipDocumentView — fenêtre Document PiP', () => {
  it('affiche le fond d’écran (image recadrée en cover) sous un voile, avec le temps et la phase', () => {
    renderView({ taskLabel: 'Écrire' })
    const image = screen.getByTestId('pip-background-image') as HTMLImageElement
    expect(image.getAttribute('src')).toBe('/backgrounds/x.webp')
    expect(image.style.objectFit).toBe('cover')
    expect(image.style.objectPosition).toBe('center top')
    expect(screen.getByRole('timer')).toHaveTextContent('24:59')
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByText('Écrire')).toBeInTheDocument()
  })

  it('sans image : dégradé seul', () => {
    renderView({ background: { ...BACKGROUND, imageSrc: null } })
    expect(screen.queryByTestId('pip-background-image')).not.toBeInTheDocument()
  })

  it('en cours : bouton Pause ; en pause : Reprendre ; à l’arrêt : Lancer — tous nommés pour les lecteurs d’écran', () => {
    const { unmount } = render(
      <PipDocumentView
        segmentLabel="F"
        timeLabel="1"
        background={BACKGROUND}
        status="running"
        onPrimary={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
    unmount()
    const second = render(
      <PipDocumentView
        segmentLabel="F"
        timeLabel="1"
        background={BACKGROUND}
        status="paused"
        onPrimary={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
    second.unmount()
    render(
      <PipDocumentView
        segmentLabel="F"
        timeLabel="1"
        background={BACKGROUND}
        status="idle"
        onPrimary={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()
  })

  it('les boutons appellent Pause/Reprendre et Arrêter, au clic comme au clavier', async () => {
    const user = userEvent.setup()
    const { onPrimary, onEnd } = renderView()

    await user.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    expect(onPrimary).toHaveBeenCalledTimes(1)

    screen.getByRole('button', { name: 'Terminer' }).focus()
    await user.keyboard('{Enter}')
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('lecture seule (participant non hôte) : aucune commande', () => {
    renderView({ onPrimary: undefined, onEnd: undefined })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('porte un anneau de focus clavier et respecte prefers-reduced-motion (balise <style> embarquée)', () => {
    renderView()
    const style = document.querySelector('[data-testid="pip-document"] style')?.textContent ?? ''
    expect(style).toContain(':focus-visible')
    expect(style).toContain('prefers-reduced-motion')
  })
})
