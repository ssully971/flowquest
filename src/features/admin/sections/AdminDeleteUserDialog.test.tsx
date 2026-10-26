import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AdminDeleteUserDialog } from './AdminDeleteUserDialog'

const deleteUserNuclearMock = vi.fn()

vi.mock('../admin-delete-user', () => ({
  deleteUserNuclear: (...args: unknown[]) => deleteUserNuclearMock(...args),
}))

function renderDialog(onDeleted = vi.fn(), onCancel = vi.fn()) {
  return {
    onDeleted,
    onCancel,
    ...render(
      <ToastProvider>
        <AdminDeleteUserDialog
          userId="u1"
          username="bob"
          onDeleted={onDeleted}
          onCancel={onCancel}
        />
      </ToastProvider>,
    ),
  }
}

beforeEach(() => {
  deleteUserNuclearMock.mockReset()
})

describe('AdminDeleteUserDialog — suppression nucléaire (lot I3, §5)', () => {
  it('le bouton de suppression reste désactivé tant que rien n’est saisi', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Supprimer définitivement' })).toBeDisabled()
  })

  it('appelle deleteUserNuclear avec le pseudo exact saisi', async () => {
    deleteUserNuclearMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { onDeleted } = renderDialog()

    await user.type(screen.getByPlaceholderText('Pseudo du compte'), 'bob')
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(deleteUserNuclearMock).toHaveBeenCalledWith('u1', 'bob')
    expect(onDeleted).toHaveBeenCalled()
  })

  it('affiche une erreur de correspondance et n’appelle jamais onDeleted', async () => {
    deleteUserNuclearMock.mockRejectedValue(
      new Error('Le pseudo saisi ne correspond pas à celui du compte à supprimer'),
    )
    const user = userEvent.setup()
    const { onDeleted } = renderDialog()

    await user.type(screen.getByPlaceholderText('Pseudo du compte'), 'pasbob')
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByText('Le pseudo saisi ne correspond pas.')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('le bouton Annuler appelle onCancel sans rien supprimer', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onCancel).toHaveBeenCalled()
    expect(deleteUserNuclearMock).not.toHaveBeenCalled()
  })
})
