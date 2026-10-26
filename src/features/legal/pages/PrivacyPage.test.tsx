import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { PrivacyPage } from './PrivacyPage'

function renderPage() {
  return render(
    <ThemeProvider>
      <PrivacyPage />
    </ThemeProvider>,
  )
}

describe('PrivacyPage (lot I1, §3)', () => {
  it('affiche le titre, la date de mise à jour et un sommaire cohérent avec les sections', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { name: 'Politique de confidentialité' }),
    ).toBeInTheDocument()

    const tocLinks = screen.getByRole('navigation', { name: 'Sommaire' }).querySelectorAll('a')
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(tocLinks.length).toBe(sectionHeadings.length)
  })

  it('affirme l’absence de vente de données, de publicité et de traceurs tiers', () => {
    renderPage()
    expect(screen.getByText(/ne vendons jamais tes données/)).toBeInTheDocument()
    expect(screen.getByText(/aucune publicité/)).toBeInTheDocument()
    expect(
      screen.getByText(/traceur publicitaire ou de mesure d.audience tiers/i),
    ).toBeInTheDocument()
  })

  it('liste les quatre sous-traitants réels (Supabase, Vercel, Brevo, Google)', () => {
    renderPage()
    expect(screen.getByText('Supabase')).toBeInTheDocument()
    expect(screen.getByText('Vercel')).toBeInTheDocument()
    expect(screen.getByText('Brevo')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('explique les droits RGPD et renvoie vers la CNIL', () => {
    renderPage()
    expect(
      screen.getByText(/droit d'introduire une réclamation|droit d’introduire une réclamation/),
    ).toBeInTheDocument()
    expect(screen.getByText(/cnil\.fr/)).toBeInTheDocument()
  })
})
