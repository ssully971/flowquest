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
    expect(screen.getAllByText(/sullivanhuriez@gmail\.com/).length).toBeGreaterThan(0)
  })

  it('renseigne l’éditeur et le directeur de la publication, sans aucun champ à compléter', () => {
    renderPage()
    expect(screen.getByText(/est édité par Sullivan Huriez, 616 Rue de Patay/)).toBeInTheDocument()
    expect(screen.getByText('Directeur de la publication : Sullivan Huriez.')).toBeInTheDocument()
    expect(screen.queryByText(/À COMPLÉTER/)).not.toBeInTheDocument()
  })

  it('donne les coordonnées complètes de Vercel et de Supabase', () => {
    renderPage()
    expect(screen.getByText(/Vercel Inc\./)).toBeInTheDocument()
    expect(screen.getByText(/440 N Barranca Ave #4133, Covina, CA 91723/)).toBeInTheDocument()
    expect(screen.getByText(/Supabase Pte\. Ltd\./)).toBeInTheDocument()
    expect(screen.getByText(/65 Chulia Street #38-02\/03/)).toBeInTheDocument()
    expect(screen.getByText(/legal@supabase\.com/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://vercel.com' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://supabase.com' })).toBeInTheDocument()
  })
})
