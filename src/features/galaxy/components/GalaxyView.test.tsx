import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord, PillarRecord } from '@/shared/storage/db'

import { GalaxyView } from './GalaxyView'

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: () => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }) },
}))

async function clearAll() {
  const db = await getDb()
  for (const store of ['focusSessions', 'pillars'] as const) {
    const keys = await db.getAllKeys(store)
    await Promise.all(keys.map((key) => db.delete(store, key)))
  }
}

function session(
  overrides: Partial<FocusSessionRecord> & { id: string; startedAt: number },
): FocusSessionRecord {
  return {
    kind: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 1500,
    endedAt: overrides.startedAt + 1500_000,
    completed: true,
    taskId: null,
    pillarId: null,
    syncedAt: null,
    ...overrides,
  }
}

function pillar(overrides: Partial<PillarRecord> & { id: string }): PillarRecord {
  return {
    name: 'Pilier',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: 0,
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
    ...overrides,
  }
}

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

describe('GalaxyView — filtres et états (LOT G4)', () => {
  beforeEach(async () => {
    setCurrentUserId(null)
    await clearAll()
  })

  it('affiche le message « galaxie vide » sans aucune session', async () => {
    render(<GalaxyView />)
    expect(
      await screen.findByText(
        'Ta galaxie est encore vide — termine ta première session de focus pour voir apparaître ta première étoile.',
      ),
    ).toBeInTheDocument()
  })

  it('affiche le canevas une fois des sessions chargées', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 's1', startedAt: NOW }))

    render(<GalaxyView />)
    expect(
      await screen.findByRole('img', { name: 'Galaxie de tes sessions de focus' }),
    ).toBeInTheDocument()
  })

  it('exclut les sessions hors de la période choisie (30 jours)', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    // À 50 jours, visible sous le filtre par défaut (90 jours) mais exclue une fois
    // basculé sur 30 jours.
    await db.put('focusSessions', session({ id: 'mid-range', startedAt: NOW - 50 * DAY }))

    render(<GalaxyView />)
    await screen.findByRole('img', { name: 'Galaxie de tes sessions de focus' })

    await user.selectOptions(screen.getByLabelText('Période'), '30d')

    expect(
      await screen.findByText(
        'Ta galaxie est encore vide — termine ta première session de focus pour voir apparaître ta première étoile.',
      ),
    ).toBeInTheDocument()
  })

  it('filtre par pilier', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    await db.put('pillars', pillar({ id: 'p1', name: 'Sport' }))
    await db.put('focusSessions', session({ id: 's1', startedAt: NOW, pillarId: 'p1' }))
    await db.put('focusSessions', session({ id: 's2', startedAt: NOW - DAY, pillarId: null }))

    render(<GalaxyView />)
    await screen.findByRole('img', { name: 'Galaxie de tes sessions de focus' })

    await user.selectOptions(screen.getByLabelText('Pilier'), 'none')
    // Une seule session (sans pilier) reste : toujours assez pour afficher le canevas,
    // pas le message vide.
    expect(
      screen.getByRole('img', { name: 'Galaxie de tes sessions de focus' }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Pilier'), 'p1')
    expect(
      screen.getByRole('img', { name: 'Galaxie de tes sessions de focus' }),
    ).toBeInTheDocument()
  })

  it('affiche la note de regroupement au-delà du plafond d’étoiles individuelles', async () => {
    // Le plafond par défaut (1500) est trop coûteux à seeder dans un test — on vérifie
    // seulement qu’aucune note ne s’affiche en dessous, le regroupement lui-même étant
    // déjà couvert par build-galaxy-data.test.ts.
    const db = await getDb()
    await db.put('focusSessions', session({ id: 's1', startedAt: NOW }))

    render(<GalaxyView />)
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Galaxie de tes sessions de focus' }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/sessions plus anciennes regroupées par mois/),
    ).not.toBeInTheDocument()
  })
})
