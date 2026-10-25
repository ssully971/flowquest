import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'

describe('KeyboardShortcutsHelp — LOT G1', () => {
  it('ne rend rien quand fermée', () => {
    render(<KeyboardShortcutsHelp open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('liste les cinq raccourcis', () => {
    render(<KeyboardShortcutsHelp open onClose={vi.fn()} />)
    expect(screen.getByText('Espace')).toBeInTheDocument()
    expect(screen.getByText('N / →')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('le bouton Fermer appelle onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<KeyboardShortcutsHelp open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('Échap appelle onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<KeyboardShortcutsHelp open onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
