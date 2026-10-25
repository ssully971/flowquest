import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { getDb } from '@/shared/storage/db'
import type { PillarRecord } from '@/shared/storage/db'

import { PillarsPage } from './PillarsPage'

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: () => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }) },
}))

async function clearPillars() {
  const db = await getDb()
  const keys = await db.getAllKeys('pillars')
  await Promise.all(keys.map((key) => db.delete('pillars', key)))
}

async function seedPillars(count: number) {
  const db = await getDb()
  for (let index = 0; index < count; index++) {
    const pillar: PillarRecord = {
      id: `seed-${index}`,
      name: `Pilier ${index}`,
      color: '#4A9FE8',
      currentXp: 0,
      level: 1,
      createdAt: Date.now() + index,
      archivedAt: null,
    }
    await db.put('pillars', pillar)
  }
}

describe('PillarsPage — Réglages > Piliers (LOT G3)', () => {
  beforeEach(async () => {
    setCurrentUserId(null)
    await clearPillars()
  })

  it('affiche le pilier par défaut « Général »', async () => {
    render(<PillarsPage />)
    expect(await screen.findByRole('button', { name: 'Général' })).toBeInTheDocument()
  })

  it('ajoute un nouveau pilier via le formulaire', async () => {
    const user = userEvent.setup()
    render(<PillarsPage />)
    await screen.findByRole('button', { name: 'Général' })

    await user.type(screen.getByPlaceholderText('Nouveau pilier…'), 'Sport')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByRole('button', { name: 'Sport' })).toBeInTheDocument()
  })

  it('renomme un pilier en cliquant sur son nom', async () => {
    const user = userEvent.setup()
    render(<PillarsPage />)
    await screen.findByRole('button', { name: 'Général' })

    await user.click(screen.getByRole('button', { name: 'Général' }))
    const input = screen.getByLabelText('Nom du pilier')
    await user.clear(input)
    await user.type(input, 'Travail{Enter}')

    expect(await screen.findByRole('button', { name: 'Travail' })).toBeInTheDocument()
    expect(screen.queryByText('Général')).not.toBeInTheDocument()
  })

  it('archive puis désarchive un pilier', async () => {
    const user = userEvent.setup()
    render(<PillarsPage />)
    await screen.findByRole('button', { name: 'Général' })

    await user.click(screen.getByRole('button', { name: 'Archiver' }))
    expect(await screen.findByText('Archivés')).toBeInTheDocument()
    expect(screen.getByText('Aucun pilier pour l’instant.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Désarchiver' }))
    await waitFor(() => expect(screen.queryByText('Archivés')).not.toBeInTheDocument())
  })

  it('masque le formulaire d’ajout et affiche l’avertissement à 8 piliers actifs', async () => {
    await seedPillars(8)
    render(<PillarsPage />)

    expect(await screen.findByRole('button', { name: 'Pilier 7' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Nouveau pilier…')).not.toBeInTheDocument()
    expect(
      screen.getByText('Maximum 8 piliers actifs — archive-en un pour en créer un nouveau.'),
    ).toBeInTheDocument()
  })
})
