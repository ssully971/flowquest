import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function TriggerButton({ action }: { action?: { label: string; onClick: () => void } }) {
  const { showToast } = useToast()
  return (
    <button type="button" onClick={() => showToast({ type: 'info', message: 'Un message', action })}>
      Déclencher
    </button>
  )
}

describe('ToastProvider — bouton d’action optionnel (LOT G2)', () => {
  it('affiche le toast sans bouton d’action par défaut', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <TriggerButton />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Déclencher' }))

    expect(await screen.findByText('Un message')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument()
  })

  it('le bouton d’action appelle onClick puis referme le toast', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ToastProvider>
        <TriggerButton action={{ label: 'Reprendre', onClick }} />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Déclencher' }))
    await screen.findByText('Un message')

    await user.click(screen.getByRole('button', { name: 'Reprendre' }))

    expect(onClick).toHaveBeenCalled()
    expect(screen.queryByText('Un message')).not.toBeInTheDocument()
  })

  it('le bouton Fermer referme le toast sans appeler l’action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ToastProvider>
        <TriggerButton action={{ label: 'Reprendre', onClick }} />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Déclencher' }))
    await screen.findByText('Un message')

    await user.click(screen.getByRole('button', { name: 'Fermer la notification' }))

    expect(onClick).not.toHaveBeenCalled()
    expect(screen.queryByText('Un message')).not.toBeInTheDocument()
  })

  it('se referme automatiquement après 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(
      <ToastProvider>
        <TriggerButton />
      </ToastProvider>,
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Déclencher' }).click()
    })
    expect(screen.getByText('Un message')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByText('Un message')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
