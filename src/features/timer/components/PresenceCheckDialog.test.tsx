import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GUARD_ANNOUNCEMENT_MS, GuardAnnouncement } from './GuardAnnouncement'
import { PresenceCheckDialog } from './PresenceCheckDialog'

describe('PresenceCheckDialog — « Tu es toujours là ? »', () => {
  function renderDialog(props: Partial<Parameters<typeof PresenceCheckDialog>[0]> = {}) {
    const handlers = { onConfirm: vi.fn(), onEnd: vi.fn() }
    render(<PresenceCheckDialog kind="frozen" soundBlocked={false} {...handlers} {...props} />)
    return handlers
  }

  it('est une fenêtre modale nommée, avec le focus sur « Je suis là »', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Tu es toujours là ?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Je suis là' })).toHaveFocus()
  })

  it('« Je suis là » confirme, « Terminer la session » termine', async () => {
    const user = userEvent.setup()
    const { onConfirm, onEnd } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Je suis là' }))
    await user.click(screen.getByRole('button', { name: 'Terminer la session' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('bloquante : Échap ne la ferme pas et ne confirme rien', async () => {
    const user = userEvent.setup()
    const { onConfirm, onEnd } = renderDialog()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('garde le focus entre ses deux boutons (Tab / Maj+Tab bouclent)', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Terminer la session' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Je suis là' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Terminer la session' })).toHaveFocus()
  })

  it('texte propre au Pomodoro, et repli visuel quand le son est bloqué', () => {
    renderDialog({ kind: 'pomodoro', soundBlocked: true })
    expect(screen.getByText(/Le prochain focus ne démarrera pas/)).toBeInTheDocument()
    expect(screen.getByText(/Le son est bloqué/)).toBeInTheDocument()
  })
})

describe('GuardAnnouncement — petite carte non bloquante', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('apparaît à chaque nouveau déclencheur, disparaît seule après ~8 s', async () => {
    vi.useFakeTimers()
    const { rerender } = render(<GuardAnnouncement triggerKey={0} enabled />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<GuardAnnouncement triggerKey={1} enabled />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Dans 4 h de focus, on te demandera si tu es toujours là.',
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GUARD_ANNOUNCEMENT_MS - 100)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // Après une confirmation : de nouveau annoncée.
    rerender(<GuardAnnouncement triggerKey={2} enabled />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('fermable à la main', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<GuardAnnouncement triggerKey={0} enabled />)
    rerender(<GuardAnnouncement triggerKey={1} enabled />)
    await user.click(screen.getByRole('button', { name: 'Fermer l’annonce' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('réglage désactivé : jamais affichée (le contrôle reste, lui, obligatoire)', () => {
    const { rerender } = render(<GuardAnnouncement triggerKey={0} enabled={false} />)
    rerender(<GuardAnnouncement triggerKey={1} enabled={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
