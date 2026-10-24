import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MyFriendCode } from './MyFriendCode'

describe('MyFriendCode — code ami avec copie, partage et régénération (LOT F1)', () => {
  const originalClipboard = navigator.clipboard
  const originalShare = (navigator as unknown as { share?: unknown }).share
  const originalConfirm = window.confirm

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true })
    window.confirm = originalConfirm
    vi.restoreAllMocks()
  })

  it('affiche le code', () => {
    render(<MyFriendCode code="A3F7K9P2" onRegenerate={vi.fn()} />)
    expect(screen.getByText('A3F7K9P2')).toBeInTheDocument()
  })

  it('copier écrit le code dans le presse-papiers', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<MyFriendCode code="A3F7K9P2" onRegenerate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Copier' }))

    expect(writeText).toHaveBeenCalledWith('A3F7K9P2')
  })

  it('n’affiche le bouton Partager que si la Web Share API est disponible', () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const { rerender } = render(<MyFriendCode code="A3F7K9P2" onRegenerate={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Partager' })).not.toBeInTheDocument()

    Object.defineProperty(navigator, 'share', { value: vi.fn().mockResolvedValue(undefined), configurable: true })
    rerender(<MyFriendCode code="A3F7K9P2" onRegenerate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Partager' })).toBeInTheDocument()
  })

  it('régénérer demande confirmation puis appelle onRegenerate', async () => {
    const user = userEvent.setup()
    window.confirm = vi.fn().mockReturnValue(true)
    const onRegenerate = vi.fn().mockResolvedValue('NEWCODE1')
    render(<MyFriendCode code="A3F7K9P2" onRegenerate={onRegenerate} />)

    await user.click(screen.getByRole('button', { name: 'Générer un nouveau code' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(onRegenerate).toHaveBeenCalled()
  })

  it('n’appelle pas onRegenerate si la confirmation est refusée', async () => {
    const user = userEvent.setup()
    window.confirm = vi.fn().mockReturnValue(false)
    const onRegenerate = vi.fn()
    render(<MyFriendCode code="A3F7K9P2" onRegenerate={onRegenerate} />)

    await user.click(screen.getByRole('button', { name: 'Générer un nouveau code' }))

    expect(onRegenerate).not.toHaveBeenCalled()
  })
})
