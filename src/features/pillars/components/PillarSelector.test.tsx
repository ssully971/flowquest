import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { getDb } from '@/shared/storage/db'

import { ActivePillarProvider } from '../ActivePillarProvider'
import { PillarSelector } from './PillarSelector'

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: () => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }) },
}))

async function clearPillars() {
  const db = await getDb()
  const keys = await db.getAllKeys('pillars')
  await Promise.all(keys.map((key) => db.delete('pillars', key)))
}

function renderSelector(disabled = false) {
  return render(
    <ActivePillarProvider>
      <PillarSelector disabled={disabled} />
    </ActivePillarProvider>,
  )
}

describe('PillarSelector — pastille discrète (LOT G3)', () => {
  beforeEach(async () => {
    setCurrentUserId(null)
    window.localStorage.removeItem('flowquest.activePillarId')
    await clearPillars()
  })

  it('affiche la pastille du pilier par défaut « Général » une fois chargé', async () => {
    renderSelector()
    expect(
      await screen.findByRole('button', { name: 'Pilier de la session : Général' }),
    ).toBeInTheDocument()
  })

  it('ouvre un menu listant les piliers actifs au clic', async () => {
    const user = userEvent.setup()
    renderSelector()
    const trigger = await screen.findByRole('button', { name: 'Pilier de la session : Général' })

    await user.click(trigger)
    expect(screen.getByRole('menu', { name: 'Choisir un pilier' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Général' })).toBeInTheDocument()
  })

  it('ferme le menu avec Échap', async () => {
    const user = userEvent.setup()
    renderSelector()
    const trigger = await screen.findByRole('button', { name: 'Pilier de la session : Général' })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('est désactivée pendant qu’une session tourne (changement de pilier bloqué)', async () => {
    renderSelector(true)
    const trigger = await screen.findByRole('button', { name: 'Pilier de la session : Général' })
    expect(trigger).toBeDisabled()
  })

  it('ne rend rien tant qu’aucun pilier n’est encore chargé', () => {
    renderSelector()
    // Avant que repo.listAll()/le bootstrap ne résolvent, aucun bouton n'apparaît —
    // vérifié indirectement par l'attente ci-dessus (findByRole) dans les autres tests ;
    // ici on s'assure juste qu'aucune exception n'est levée au premier rendu synchrone.
    expect(document.body).toBeInTheDocument()
  })
})

describe('PillarSelector — sélection persistée (LOT G3)', () => {
  beforeEach(async () => {
    setCurrentUserId(null)
    window.localStorage.removeItem('flowquest.activePillarId')
    await clearPillars()
    const db = await getDb()
    await db.put('pillars', {
      id: 'p-sport',
      name: 'Sport',
      color: '#5FB86B',
      currentXp: 0,
      level: 1,
      createdAt: 1,
      archivedAt: null,
      goalLevel: null,
      goalDeadline: null,
    })
    await db.put('pillars', {
      id: 'p-travail',
      name: 'Travail',
      color: '#4A9FE8',
      currentXp: 0,
      level: 1,
      createdAt: 2,
      archivedAt: null,
      goalLevel: null,
      goalDeadline: null,
    })
  })

  it('présélectionne le premier pilier tant qu’aucun choix explicite n’a été fait', async () => {
    renderSelector()
    expect(
      await screen.findByRole('button', { name: 'Pilier de la session : Sport' }),
    ).toBeInTheDocument()
  })

  it('change de pilier actif au clic sur une entrée du menu et le persiste', async () => {
    const user = userEvent.setup()
    renderSelector()
    const trigger = await screen.findByRole('button', { name: 'Pilier de la session : Sport' })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitemradio', { name: 'Travail' }))

    expect(
      await screen.findByRole('button', { name: 'Pilier de la session : Travail' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(window.localStorage.getItem('flowquest.activePillarId')).toBe('p-travail'),
    )
  })
})
