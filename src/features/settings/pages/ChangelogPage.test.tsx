import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CHANGELOG } from '@/features/settings/changelog'

import { ChangelogPage } from './ChangelogPage'

describe('ChangelogPage — journal des versions (§7.9 du cahier des charges)', () => {
  it('affiche au moins une entrée, jamais le message vide (liste de départ non vide)', () => {
    render(<ChangelogPage />)
    expect(screen.queryByText('Aucune nouveauté pour l’instant.')).not.toBeInTheDocument()
    expect(CHANGELOG.length).toBeGreaterThan(0)
  })

  it('affiche la version, la date et le texte de chaque entrée', () => {
    render(<ChangelogPage />)
    const latest = CHANGELOG[0]
    expect(screen.getByText(latest.version)).toBeInTheDocument()
    expect(screen.getByText(latest.date)).toBeInTheDocument()
    expect(screen.getByText(latest.text)).toBeInTheDocument()
  })
})
