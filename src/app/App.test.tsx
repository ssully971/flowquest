import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'

beforeEach(() => {
  window.localStorage.clear()
})

describe('App', () => {
  it('affiche l’accueil par défaut avec le cadre commun (tâches, notes, série, mode, réglages, plein écran)', () => {
    render(<App />)

    expect(screen.getByRole('radio', { name: 'Accueil' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Tâches' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Bloc-notes' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeEnabled()
  })

  it('ouvre le panneau des tâches et permet d’ajouter une tâche', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Tâches' }))
    const input = await screen.findByPlaceholderText('Nouvelle tâche…')
    await user.type(input, 'Réviser le cours de biologie')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByText('Réviser le cours de biologie')).toBeInTheDocument()
  })

  it('ouvre le bloc-notes et enregistre automatiquement le texte saisi', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Bloc-notes' }))
    const editor = await screen.findByRole('textbox', { name: 'Écris une note rapide…' })
    await user.type(editor, 'Idée de session')

    expect(editor).toHaveTextContent('Idée de session')
  })

  it('bascule vers Focus et affiche le minuteur une fois restauré', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('radio', { name: 'Focus' }))
    expect(await screen.findByText('Sur quoi veux-tu te concentrer ?')).toBeInTheDocument()
  })

  it('ouvre le panneau de réglages sur la page Thèmes et le ferme via Échap', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Réglages' }))
    expect(await screen.findByRole('dialog', { name: 'Réglages' })).toBeInTheDocument()
    expect(screen.getAllByText('Thèmes').length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')
    // Le démontage est piloté par la fin de l'animation CSS (transitionend), pas par un
    // minuteur à durée fixe (voir SettingsPanel.tsx). jsdom ne joue aucune transition
    // réelle : on simule donc la fin de l'animation comme le ferait un vrai navigateur.
    fireEvent.transitionEnd(screen.getByRole('dialog', { name: 'Réglages' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Réglages' })).not.toBeInTheDocument()
    })
  })

  it('bascule vers Ambiant, affiche le minuteur compact et masque Tâches/Bloc-notes (§5.3)', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('radio', { name: 'Ambiant' }))
    expect(await screen.findByTestId('big-digits')).toHaveTextContent('25:00')
    expect(screen.queryByRole('button', { name: 'Tâches' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bloc-notes' })).not.toBeInTheDocument()
  })

  it('/admin affiche la garde de route au lieu du tableau de bord normal', () => {
    window.history.pushState({}, '', '/admin')
    render(<App />)

    expect(screen.getByText('Accès réservé aux administrateurs.')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Accueil' })).not.toBeInTheDocument()

    window.history.pushState({}, '', '/')
  })

  it('/diagnostic affiche la page de diagnostic au lieu du tableau de bord normal', () => {
    window.history.pushState({}, '', '/diagnostic')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Diagnostic' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Accueil' })).not.toBeInTheDocument()

    window.history.pushState({}, '', '/')
  })

  describe('pages légales, accessibles sans connexion (lot I1, §3)', () => {
    it('/conditions affiche les conditions d’utilisation', () => {
      window.history.pushState({}, '', '/conditions')
      render(<App />)

      expect(screen.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: 'Accueil' })).not.toBeInTheDocument()

      window.history.pushState({}, '', '/')
    })

    it('/confidentialite affiche la politique de confidentialité', () => {
      window.history.pushState({}, '', '/confidentialite')
      render(<App />)

      expect(
        screen.getByRole('heading', { name: 'Politique de confidentialité' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: 'Accueil' })).not.toBeInTheDocument()

      window.history.pushState({}, '', '/')
    })

    it('/mentions-legales affiche les mentions légales', () => {
      window.history.pushState({}, '', '/mentions-legales')
      render(<App />)

      expect(screen.getByRole('heading', { name: 'Mentions légales' })).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: 'Accueil' })).not.toBeInTheDocument()

      window.history.pushState({}, '', '/')
    })
  })
})
