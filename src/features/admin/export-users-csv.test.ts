import { describe, expect, it } from 'vitest'

import { buildUsersCsv } from './export-users-csv'

describe('export-users-csv — export CSV (lot I3, §4)', () => {
  it('commence par un BOM UTF-8 (nécessaire pour Excel)', () => {
    const csv = buildUsersCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('inclut l’en-tête attendu, même sans ligne', () => {
    const csv = buildUsersCsv([])
    const header = csv.slice(1)
    expect(header).toBe(
      "E-mail,Pseudo,Date d'inscription,Dernière activité,Consentement newsletter",
    )
  })

  it('formate une ligne avec consentement « Oui »/« Non » et dates tronquées au jour', () => {
    const csv = buildUsersCsv([
      {
        email: 'alice@exemple.com',
        username: 'alice',
        created_at: '2026-01-15T10:30:00.000Z',
        last_active_at: '2026-02-01T08:00:00.000Z',
        marketing_consent: true,
      },
      {
        email: 'bob@exemple.com',
        username: 'bob',
        created_at: '2026-01-10T00:00:00.000Z',
        last_active_at: null,
        marketing_consent: false,
      },
    ])
    const lines = csv.slice(1).split('\n')
    expect(lines[1]).toBe('alice@exemple.com,alice,2026-01-15,2026-02-01,Oui')
    expect(lines[2]).toBe('bob@exemple.com,bob,2026-01-10,,Non')
  })

  it('échappe les champs contenant une virgule ou un guillemet', () => {
    const csv = buildUsersCsv([
      {
        email: 'test@exemple.com',
        username: 'a, b "c"',
        created_at: '2026-01-01T00:00:00.000Z',
        last_active_at: null,
        marketing_consent: false,
      },
    ])
    expect(csv).toContain('"a, b ""c"""')
  })
})
