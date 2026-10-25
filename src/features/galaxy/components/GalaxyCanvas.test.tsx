import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GalaxyData } from '../build-galaxy-data'
import { GalaxyCanvas } from './GalaxyCanvas'

const DATA: GalaxyData = {
  stars: [
    {
      id: 's1',
      x: 0.2,
      y: 0.3,
      radius: 4,
      color: '#4A9FE8',
      isCluster: false,
      date: Date.now(),
      durationSeconds: 1500,
      pillarName: 'Travail',
      sessionCount: 1,
    },
    {
      id: 'cluster:2026-01:none',
      x: 0.7,
      y: 0.6,
      radius: 6,
      color: '#8A93A6',
      isCluster: true,
      date: Date.now(),
      durationSeconds: 9000,
      pillarName: null,
      sessionCount: 12,
    },
  ],
  lines: [{ x1: 0.2, y1: 0.3, x2: 0.7, y2: 0.6 }],
  clusteredSessionCount: 12,
}

describe('GalaxyCanvas — rendu (LOT G4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rend un canvas accessible, sans planter (ResizeObserver/canvas absents de jsdom)', () => {
    render(<GalaxyCanvas data={DATA} />)
    expect(screen.getByRole('img', { name: 'Galaxie de tes sessions de focus' })).toBeInTheDocument()
  })

  it('ne lève aucune erreur avec un jeu de données vide', () => {
    render(<GalaxyCanvas data={{ stars: [], lines: [], clusteredSessionCount: 0 }} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('n’affiche aucune info-bulle avant toute interaction', () => {
    render(<GalaxyCanvas data={DATA} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
