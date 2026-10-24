import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AvatarCropper } from './AvatarCropper'

function fakeBitmap(width = 256, height = 256): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

describe('AvatarCropper — recadrage carré avec zoom et déplacement (LOT F1)', () => {
  it('affiche le titre, l’aperçu et le curseur de zoom', () => {
    render(
      <AvatarCropper bitmap={fakeBitmap()} isUploading={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(screen.getByText('Cadre ta photo')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Aperçu de la photo recadrée' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Zoom' })).toBeInTheDocument()
  })

  it('Annuler appelle onCancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <AvatarCropper bitmap={fakeBitmap()} isUploading={false} error={null} onCancel={onCancel} onConfirm={vi.fn()} />,
    )
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('Valider appelle onConfirm avec le zoom et le déplacement courants', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <AvatarCropper bitmap={fakeBitmap()} isUploading={false} error={null} onCancel={vi.fn()} onConfirm={onConfirm} />,
    )
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 1, panX: 0, panY: 0, viewportSize: 240 }),
    )
  })

  it('désactive les contrôles pendant l’envoi et affiche « Enregistrement… »', () => {
    render(
      <AvatarCropper bitmap={fakeBitmap()} isUploading error={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Zoom' })).toBeDisabled()
  })

  it('affiche le message d’erreur quand il est fourni', () => {
    render(
      <AvatarCropper
        bitmap={fakeBitmap()}
        isUploading={false}
        error="Cette image est trop lourde."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Cette image est trop lourde.')
  })
})
