import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { LegalNoticePage } from './LegalNoticePage'

function renderPage() {
  return render(
    <ThemeProvider>
      <LegalNoticePage />
    </ThemeProvider>,
  )
}

describe('LegalNoticePage (lot I1, §3)', () => {
  it('affiche le titre et le contact', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Mentions légales' })).toBeInTheDocument()
    expect(screen.getByText(/flowquestt@gmail\.com/)).toBeInTheDocument()
  })

  it('marque « [À COMPLÉTER] » les informations que seul l’éditeur peut fournir, jamais inventées', () => {
    renderPage()
    const placeholders = screen.getAllByText(/À COMPLÉTER/)
    // Raison sociale, adresse de l'éditeur, directeur de publication, coordonnées Vercel,
    // coordonnées Supabase : 5 informations que seul l'éditeur peut fournir (voir le
    // compte rendu du lot).
    expect(placeholders.length).toBe(5)
    expect(screen.queryByText(/SAS|SARL|Monsieur|Madame/)).not.toBeInTheDocument()
  })

  it('nomme Vercel et Supabase comme hébergeurs réels', () => {
    renderPage()
    expect(screen.getAllByText(/Vercel Inc\./).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Supabase Inc\./).length).toBeGreaterThan(0)
  })
})
