import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import type { BackgroundSelections } from '@/app/background-selection'
import type { AppMode } from '@/app/useAppMode'
import type { BackgroundId } from '@/shared/design-system'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { CustomBackgroundProvider } from '../CustomBackgroundProvider'
import {
  CustomBackgroundError,
  createCustomBackgroundThumbnail,
  processCustomBackgroundFile,
} from '../custom-background'
import { CustomBackgroundSection } from './CustomBackgroundSection'

vi.mock('../custom-background', async () => {
  const actual =
    await vi.importActual<typeof import('../custom-background')>('../custom-background')
  return {
    ...actual,
    processCustomBackgroundFile: vi.fn(),
    createCustomBackgroundThumbnail: vi.fn(),
  }
})

type SelectHandler = (mode: AppMode, theme: 'dark' | 'light', id: BackgroundId) => void

const SELECTIONS: BackgroundSelections = {
  home: { dark: 'horizon', light: 'horizon', linked: true },
  focus: { dark: 'photo-aurore', light: 'photo-lueur', linked: false },
  ambient: { dark: 'photo-fjord', light: 'photo-fjord', linked: true },
}

function renderSection(
  props: {
    mode?: 'home' | 'focus' | 'ambient'
    selections?: BackgroundSelections
    onSelect?: SelectHandler
  } = {},
) {
  const onSelect = props.onSelect ?? vi.fn<SelectHandler>()
  render(
    <ToastProvider>
      <CustomBackgroundProvider>
        <CustomBackgroundSection
          mode={props.mode ?? 'home'}
          theme="dark"
          selections={props.selections ?? SELECTIONS}
          onSelect={onSelect}
        />
      </CustomBackgroundProvider>
    </ToastProvider>,
  )
  return { onSelect: onSelect as Mock<SelectHandler> }
}

async function addPhoto() {
  const input = (await screen.findByTestId('photo-file-input')) as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } })
}

beforeEach(async () => {
  const db = await getDb()
  await db.clear('customPhotos')
  await db.delete('customBackground', 'current')
  vi.mocked(processCustomBackgroundFile)
    .mockReset()
    .mockImplementation(async () => new Blob(['x']))
  vi.mocked(createCustomBackgroundThumbnail)
    .mockReset()
    .mockImplementation(async () => new Blob(['t']))
  let count = 0
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => `blob:fake-${count++}`),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CustomBackgroundSection — bibliothèque de photos et affectation par mode', () => {
  it('bibliothèque vide : invite à ajouter une photo, avec le compteur de plafond', async () => {
    renderSection()
    expect(await screen.findByRole('button', { name: 'Ajouter une photo' })).toBeEnabled()
    expect(screen.getByText('Aucune photo pour l’instant.')).toBeInTheDocument()
    expect(screen.getByTestId('photo-usage')).toHaveTextContent('0 / 12 photos')
    expect(screen.getByTestId('photo-usage')).toHaveTextContent('40 Mo')
  })

  it('une photo ajoutée est aussitôt affectée au mode réglé (et reste dans la grille)', async () => {
    const { onSelect } = renderSection({ mode: 'focus' })
    await addPhoto()

    await screen.findByRole('button', { name: /^Photo 1/ })
    expect(onSelect).toHaveBeenCalledWith('focus', 'dark', expect.stringMatching(/^custom:/))
  })

  it('cliquer une vignette l’affecte au mode réglé ; une seconde photo n’efface pas la première', async () => {
    const { onSelect } = renderSection({ mode: 'ambient' })
    await addPhoto()
    await screen.findByRole('button', { name: /^Photo 1/ })
    await addPhoto()
    await screen.findByRole('button', { name: /^Photo 2/ })
    onSelect.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /^Photo 1/ }))
    expect(onSelect).toHaveBeenCalledWith('ambient', 'dark', expect.stringMatching(/^custom:/))
    expect(screen.getAllByRole('button', { name: /^Photo \d/ })).toHaveLength(2)
  })

  it('indique pour chaque photo les modes qui l’utilisent (un fond différent par mode)', async () => {
    const db = await getDb()
    await db.put('customPhotos', {
      id: 'a',
      blob: new Blob(['x']),
      thumb: new Blob(['t']),
      position: 'center',
      size: 2,
      createdAt: 1,
    })
    await db.put('customPhotos', {
      id: 'b',
      blob: new Blob(['x']),
      thumb: new Blob(['t']),
      position: 'center',
      size: 2,
      createdAt: 2,
    })
    renderSection({
      selections: {
        home: { dark: 'custom:a', light: 'custom:a', linked: true },
        focus: { dark: 'custom:b', light: 'custom:b', linked: true },
        ambient: { dark: 'custom:a', light: 'custom:a', linked: true },
      },
    })

    const photoA = await screen.findByRole('button', {
      name: /^Photo 1 — Utilisée : Accueil, Ambiant$/,
    })
    const photoB = screen.getByRole('button', { name: /^Photo 2 — Utilisée : Focus$/ })
    expect(photoA).toBeInTheDocument()
    expect(photoB).toBeInTheDocument()
  })

  it('un message d’erreur clair s’affiche si l’ajout échoue (fichier invalide, plafond…)', async () => {
    vi.mocked(processCustomBackgroundFile).mockRejectedValue(
      new CustomBackgroundError('Cette image est trop lourde (20 Mo maximum).'),
    )
    renderSection()
    await addPhoto()
    expect(
      await screen.findByText('Cette image est trop lourde (20 Mo maximum).'),
    ).toBeInTheDocument()
  })

  it('supprimer une photo (avec confirmation) remet un fond par défaut aux modes qui l’utilisaient', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const db = await getDb()
    await db.put('customPhotos', {
      id: 'a',
      blob: new Blob(['x']),
      thumb: new Blob(['t']),
      position: 'center',
      size: 2,
      createdAt: 1,
    })
    const { onSelect } = renderSection({
      selections: {
        home: { dark: 'custom:a', light: 'custom:a', linked: true },
        focus: { dark: 'custom:a', light: 'photo-lueur', linked: false },
        ambient: { dark: 'photo-fjord', light: 'photo-fjord', linked: true },
      },
    })

    await user.click(await screen.findByRole('button', { name: /Supprimer cette photo/ }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Photo 1/ })).not.toBeInTheDocument(),
    )
    // Accueil (thèmes liés) : un seul appel ; Focus : seulement le thème sombre ; Ambiant inchangé.
    expect(onSelect).toHaveBeenCalledWith('home', 'dark', 'photo-aurore')
    expect(onSelect).toHaveBeenCalledWith('focus', 'dark', 'photo-aurore')
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(await db.get('customPhotos', 'a')).toBeUndefined()
  })

  it('suppression annulée : rien ne change', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const db = await getDb()
    await db.put('customPhotos', {
      id: 'a',
      blob: new Blob(['x']),
      thumb: new Blob(['t']),
      position: 'center',
      size: 2,
      createdAt: 1,
    })
    const { onSelect } = renderSection()
    await user.click(await screen.findByRole('button', { name: /Supprimer cette photo/ }))
    expect(onSelect).not.toHaveBeenCalled()
    expect(await db.get('customPhotos', 'a')).toBeDefined()
  })

  it('bibliothèque pleine : ajout désactivé et message clair', async () => {
    const db = await getDb()
    for (let index = 0; index < 12; index += 1) {
      await db.put('customPhotos', {
        id: `p${index}`,
        blob: new Blob(['x']),
        thumb: new Blob(['t']),
        position: 'center',
        size: 2,
        createdAt: index,
      })
    }
    renderSection()
    expect(await screen.findByRole('button', { name: 'Ajouter une photo' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('limite de 12 photos')
  })

  it('le cadrage de la photo sélectionnée se règle et devient actif', async () => {
    const db = await getDb()
    await db.put('customPhotos', {
      id: 'a',
      blob: new Blob(['x']),
      thumb: new Blob(['t']),
      position: 'center',
      size: 2,
      createdAt: 1,
    })
    renderSection({
      selections: { ...SELECTIONS, home: { dark: 'custom:a', light: 'custom:a', linked: true } },
    })
    const top = await screen.findByRole('button', { name: 'Haut' })
    fireEvent.click(top)
    await waitFor(() => expect(top).toHaveAttribute('aria-pressed', 'true'))
  })
})
