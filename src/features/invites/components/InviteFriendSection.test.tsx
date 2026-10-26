import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InviteError } from '../invites-repository'
import { InviteFriendSection } from './InviteFriendSection'

const eligibilityMock = vi.fn()
const listMock = vi.fn()
const generateMock = vi.fn()
let betaClosed = true

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => betaClosed }))
vi.mock('../invites-repository', async () => {
  const actual =
    await vi.importActual<typeof import('../invites-repository')>('../invites-repository')
  return {
    ...actual,
    getInviteEligibility: () => eligibilityMock(),
    listMyInviteCodes: () => listMock(),
    generateUserInviteCode: () => generateMock(),
  }
})

function eligibility(overrides: Record<string, unknown> = {}) {
  return {
    focus_seconds: 15600, // 4 h 20
    focus_required_seconds: 36000,
    account_age_days: 3,
    account_age_required_days: 7,
    codes_this_month: 0,
    codes_monthly_limit: 2,
    next_reset_at: '2026-11-01T04:00:00.000Z',
    ...overrides,
  }
}

const eligible = () => eligibility({ focus_seconds: 40000, account_age_days: 10 })

describe('InviteFriendSection — Inviter un ami', () => {
  beforeEach(() => {
    eligibilityMock.mockReset()
    listMock.mockReset()
    generateMock.mockReset()
    listMock.mockResolvedValue([])
    betaClosed = true
  })

  it('ne s’affiche pas quand la bêta fermée est coupée', () => {
    betaClosed = false
    eligibilityMock.mockResolvedValue(eligibility())
    const { container } = render(<InviteFriendSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('conditions non remplies : bouton désactivé et progression claire', async () => {
    eligibilityMock.mockResolvedValue(eligibility())
    render(<InviteFriendSection />)

    expect(await screen.findByText('4 h 20 / 10 h')).toBeInTheDocument()
    expect(screen.getByText('3 / 7 jours')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Temps de focus' })).toHaveAttribute(
      'aria-valuenow',
      '15600',
    )
    expect(screen.getByRole('button', { name: 'Générer un code' })).toBeDisabled()
    expect(screen.getByText('0 / 2 codes utilisés ce mois-ci')).toBeInTheDocument()
  })

  it('limite mensuelle atteinte : message avec la date de réinitialisation', async () => {
    eligibilityMock.mockResolvedValue({ ...eligible(), codes_this_month: 2 })
    render(<InviteFriendSection />)

    expect(await screen.findByText(/Prochain code possible le 1er novembre/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Générer un code' })).toBeDisabled()
  })

  it('conditions remplies : génère un code, l’affiche avec Copier et son expiration', async () => {
    const user = userEvent.setup()
    eligibilityMock.mockResolvedValue(eligible())
    generateMock.mockResolvedValue({ code: 'ABCD2345', expires_at: '2099-01-01T00:00:00.000Z' })
    render(<InviteFriendSection />)

    const button = await screen.findByRole('button', { name: 'Générer un code' })
    await waitFor(() => expect(button).toBeEnabled())
    listMock.mockResolvedValue([
      {
        id: 'c1',
        code: 'ABCD2345',
        created_at: 'x',
        expires_at: '2099-01-01T00:00:00.000Z',
        is_used: false,
        used_at: null,
        used_by_username: null,
        status: 'active',
      },
    ])
    await user.click(button)

    expect(await screen.findByTestId('invite-code')).toHaveTextContent('ABCD2345')
    expect(screen.getByRole('button', { name: 'Copier' })).toBeInTheDocument()
    expect(screen.getByText(/Valable jusqu’au/)).toBeInTheDocument()
  })

  it('affiche mes codes : utilisé par un pseudo, par « un ami », expiré', async () => {
    eligibilityMock.mockResolvedValue(eligible())
    const base = { created_at: 'x', used_at: null, is_used: false }
    listMock.mockResolvedValue([
      {
        ...base,
        id: '1',
        code: 'USEDAAA2',
        expires_at: null,
        is_used: true,
        used_by_username: 'alice',
        status: 'used',
      },
      {
        ...base,
        id: '2',
        code: 'USEDBBB2',
        expires_at: null,
        is_used: true,
        used_by_username: null,
        status: 'used',
      },
      {
        ...base,
        id: '3',
        code: 'EXPIRED2',
        expires_at: '2020-01-01T00:00:00.000Z',
        used_by_username: null,
        status: 'expired',
      },
    ])
    render(<InviteFriendSection />)

    expect(await screen.findByText(/Utilisé par alice/)).toBeInTheDocument()
    expect(screen.getByText(/Utilisé par un ami/)).toBeInTheDocument()
    expect(screen.getByText(/^Expiré/)).toBeInTheDocument()
  })

  it.each([
    ['account_too_young', 'Ton compte est encore trop récent pour inviter un ami.'],
    ['not_enough_focus', 'Il te faut encore un peu de focus avant de pouvoir inviter un ami.'],
    ['monthly_limit_reached', 'Tu as déjà généré tous tes codes de ce mois-ci.'],
  ] as const)('erreur serveur %s : message français clair', async (kind, message) => {
    const user = userEvent.setup()
    eligibilityMock.mockResolvedValue(eligible())
    generateMock.mockRejectedValue(new InviteError(kind))
    render(<InviteFriendSection />)

    const button = await screen.findByRole('button', { name: 'Générer un code' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)

    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})
