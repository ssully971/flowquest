import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { TermsPage } from './TermsPage'

function renderPage() {
  return render(
    <ThemeProvider>
      <TermsPage />
    </ThemeProvider>,
  )
}

describe('TermsPage (lot I1, §3)', () => {
  it('affiche le titre, la date de mise à jour et un sommaire avec autant de liens que de sections', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeInTheDocument()
    expect(screen.getByText(/Dernière mise à jour le/)).toBeInTheDocument()

    const tocLinks = screen.getByRole('navigation', { name: 'Sommaire' }).querySelectorAll('a')
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(tocLinks.length).toBe(sectionHeadings.length)
    // Chaque lien du sommaire pointe vers une ancre qui existe réellement dans la page.
    for (const link of Array.from(tocLinks)) {
      const id = link.getAttribute('href')?.slice(1)
      expect(document.getElementById(id ?? '')).not.toBeNull()
    }
  })

  it('couvre l’âge minimum, l’usage gratuit, et le droit français', () => {
    renderPage()
    expect(screen.getByText(/15 ans/)).toBeInTheDocument()
    expect(screen.getByText(/entièrement gratuit/)).toBeInTheDocument()
    expect(screen.getByText(/soumises au droit français/)).toBeInTheDocument()
    expect(screen.getByText(/flowquestt@gmail\.com/)).toBeInTheDocument()
  })

  it('liste les interdictions (scraping, ingénierie inverse, DoS, partage de compte)', () => {
    renderPage()
    expect(screen.getByText(/moissonnage/)).toBeInTheDocument()
    expect(screen.getByText(/ingénierie inverse/)).toBeInTheDocument()
    expect(screen.getByText(/déni de service/)).toBeInTheDocument()
    expect(screen.getByText(/Partager ton compte/)).toBeInTheDocument()
  })
})
