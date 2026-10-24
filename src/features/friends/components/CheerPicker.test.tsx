import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CheerPicker } from './CheerPicker'

describe('CheerPicker — jeu fixe d’emojis (LOT F2)', () => {
  it('n’affiche pas la rangée d’emojis avant le clic', () => {
    render(<CheerPicker onSend={vi.fn()} />)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('affiche les 5 emojis fixes au clic', async () => {
    const user = userEvent.setup()
    render(<CheerPicker onSend={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Encourager' }))

    const group = screen.getByRole('group')
    expect(group).toHaveTextContent('💪')
    expect(group).toHaveTextContent('🔥')
    expect(group).toHaveTextContent('👏')
    expect(group).toHaveTextContent('❤️')
    expect(group).toHaveTextContent('☕')
  })

  it('envoyer un emoji appelle onSend et referme la rangée', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<CheerPicker onSend={onSend} />)

    await user.click(screen.getByRole('button', { name: 'Encourager' }))
    await user.click(screen.getByText('🔥'))

    expect(onSend).toHaveBeenCalledWith('🔥')
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })
})
