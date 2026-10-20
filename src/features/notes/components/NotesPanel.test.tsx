import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { getDb } from '@/shared/storage/db'

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ status: 'guest', user: null }),
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: null,
}))

function renderPanel(open = true, onClose = () => {}) {
  const utils = render(
    <ExtrasSettingsProvider>
      <div>
        <button type="button">Déclencheur</button>
        <div className="relative">
          <NotesPanel open={open} onClose={onClose} />
        </div>
      </div>
    </ExtrasSettingsProvider>,
  )
  return {
    ...utils,
    setOpen: (nextOpen: boolean) =>
      utils.rerender(
        <ExtrasSettingsProvider>
          <div>
            <button type="button">Déclencheur</button>
            <div className="relative">
              <NotesPanel open={nextOpen} onClose={onClose} />
            </div>
          </div>
        </ExtrasSettingsProvider>,
      ),
  }
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

    const editor = await screen.findByRole('textbox', { name: 'Écris une note rapide…' })
    expect(editor).toBeEmptyDOMElement()
    expect(screen.getByText('0 mots · 0 caractères')).toBeInTheDocument()

    await user.type(editor, 'Deux mots')
    await waitFor(() => expect(screen.getByText('2 mots · 9 caractères')).toBeInTheDocument())
  })

  it('affiche les boutons de mise en forme (gras, italique, titre, listes)', async () => {
    renderPanel()
    await screen.findByRole('textbox', { name: 'Écris une note rapide…' })

    expect(screen.getByRole('button', { name: 'Gras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italique' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Titre' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Liste à puces' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Liste de cases à cocher' })).toBeInTheDocument()
  })

  it('affiche le contenu déjà chargé quand le panneau s’ouvre après coup (lot 6)', async () => {
    // Régression : si le contenu se charge (useNote) avant la première ouverture du
    // panneau, `content` ne change plus une fois l'éditeur monté — sans re-synchroniser
    // aussi sur `open`, la note s'afficherait vide à l'ouverture malgré un contenu
    // déjà enregistré.
    const db = await getDb()
    await db.put('notes', { schemaVersion: 1, data: 'Note déjà enregistrée', updatedAt: Date.now() }, 'current')

    const { setOpen } = renderPanel(false)
    // Laisse le temps à useNote de charger le contenu existant pendant que le panneau
    // est encore fermé (editorRef n'existe pas encore) : c'est précisément le scénario
    // de la régression.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    setOpen(true)

    const editor = await screen.findByRole('textbox', { name: 'Écris une note rapide…' })
    await waitFor(() => expect(editor).toHaveTextContent('Note déjà enregistrée'))
  })

  it('ferme le panneau via Échap', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel(true, onClose)

    await screen.findByRole('textbox', { name: 'Écris une note rapide…' })
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('ferme le panneau via un clic en dehors', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel(true, onClose)

    await screen.findByRole('textbox', { name: 'Écris une note rapide…' })
    await user.click(screen.getByRole('button', { name: 'Déclencheur' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
