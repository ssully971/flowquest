import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { CustomBackgroundProvider } from '../CustomBackgroundProvider'
import { CustomBackgroundError, processCustomBackgroundFile } from '../custom-background'
import { CustomBackgroundSection } from './CustomBackgroundSection'

vi.mock('../custom-background', async () => {
  const actual = await vi.importActual<typeof import('../custom-background')>('../custom-background')
  return { ...actual, processCustomBackgroundFile: vi.fn() }
})

function renderSection(onSelect = vi.fn()) {
  return {
    onSelect,
    ...render(
      <ToastProvider>
        <CustomBackgroundProvider>
          <CustomBackgroundSection mode="home" currentId="horizon" onSelect={onSelect} />
        </CustomBackgroundProvider>
      </ToastProvider>,
    ),
  }
}

beforeEach(async () => {
  const db = await getDb()
  await db.delete('customBackground', 'current')
  vi.mocked(processCustomBackgroundFile).mockReset()
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
})

describe('CustomBackgroundSection — téléverser et utiliser un fond personnel (lot 3)', () => {
  it('affiche le bouton d’envoi tant qu’aucune image n’a été choisie', async () => {
    renderSection()
    expect(await screen.findByRole('button', { name: 'Choisir une image' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Utiliser pour ce mode' })).not.toBeInTheDocument()
  })

  it('après un envoi réussi, propose de l’utiliser pour ce mode', async () => {
    vi.mocked(processCustomBackgroundFile).mockResolvedValue(new Blob(['x']))
    const { onSelect } = renderSection()

    await screen.findByRole('button', { name: 'Choisir une image' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    const useButton = await screen.findByRole('button', { name: 'Utiliser pour ce mode' })
    fireEvent.click(useButton)
    expect(onSelect).toHaveBeenCalledWith('home', 'custom')
  })

  it('affiche un message d’erreur clair si l’envoi échoue', async () => {
    vi.mocked(processCustomBackgroundFile).mockRejectedValue(
      new CustomBackgroundError('Cette image est trop lourde (20 Mo maximum).'),
    )
    renderSection()

    await screen.findByRole('button', { name: 'Choisir une image' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText('Cette image est trop lourde (20 Mo maximum).'),
    ).toBeInTheDocument()
  })

  it('le cadrage choisi devient actif visuellement', async () => {
    vi.mocked(processCustomBackgroundFile).mockResolvedValue(new Blob(['x']))
    renderSection()

    await screen.findByRole('button', { name: 'Choisir une image' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } })
    await screen.findByRole('button', { name: 'Utiliser pour ce mode' })

    const topButton = screen.getByRole('button', { name: 'Haut' })
    fireEvent.click(topButton)
    await waitFor(() => expect(topButton).toHaveAttribute('aria-pressed', 'true'))
  })
})
