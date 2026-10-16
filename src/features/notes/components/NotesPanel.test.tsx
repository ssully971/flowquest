import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ status: 'guest', user: null }),
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: null,
}))

function renderPanel(open = true, onClose = () => {}) {
  return render(
    <div>
      <button type="button">Déclencheur</button>
      <div className="relative">
        <NotesPanel open={open} onClose={onClose} />
      </div>
    </div>,
  )
}

let NotesPanel: typeof import('./NotesPanel').NotesPanel

beforeEach(async () => {
  const db = await getDb()
  await db.delete('notes', 'current')
  NotesPanel = (await import('./NotesPanel')).NotesPanel
})

describe('NotesPanel', () => {
  it('ne s’affiche pas quand fermé', async () => {
    renderPanel(false)
    expect(screen.queryByRole('dialog', { name: 'Bloc-notes' })).not.toBeInTheDocument()
  })

  it('affiche un champ vide et met à jour le compteur de mots et de caractères en tapant', async () => {
    const user = userEvent.setup()
    renderPanel()

    const textarea = await screen.findByPlaceholderText('Écris une note rapide…')
    expect(textarea).toHaveValue('')
    expect(screen.getByText('0 mots · 0 caractères')).toBeInTheDocument()

    await user.type(textarea, 'Deux mots')
    expect(screen.getByText('2 mots · 9 caractères')).toBeInTheDocument()
  })

  it('ferme le panneau via Échap', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel(true, onClose)

    await screen.findByPlaceholderText('Écris une note rapide…')
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('ferme le panneau via un clic en dehors', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel(true, onClose)

    await screen.findByPlaceholderText('Écris une note rapide…')
    await user.click(screen.getByRole('button', { name: 'Déclencheur' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
