import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CustomBackgroundError,
  MAX_CUSTOM_BACKGROUND_DIMENSION,
  MAX_CUSTOM_BACKGROUND_OUTPUT_BYTES,
  MAX_CUSTOM_BACKGROUND_SOURCE_BYTES,
  processCustomBackgroundFile,
} from './custom-background'

function makeFile(options: { type?: string; size?: number } = {}): File {
  const size = options.size ?? 1024
  return new File([new Uint8Array(size)], 'photo.jpg', { type: options.type ?? 'image/jpeg' })
}

function mockImageBitmap(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width, height, close: vi.fn() }),
  )
}

function mockCanvas(outputSize: number) {
  const getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() })
  const toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
    callback(new Blob([new Uint8Array(outputSize)], { type: 'image/webp' }))
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob as never)
}

describe('processCustomBackgroundFile — validations (lot 3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refuse un fichier qui n’est pas une image', async () => {
    await expect(processCustomBackgroundFile(makeFile({ type: 'application/pdf' }))).rejects.toThrow(
      CustomBackgroundError,
    )
  })

  it('refuse une image source trop lourde (> 20 Mo)', async () => {
    await expect(
      processCustomBackgroundFile(makeFile({ size: MAX_CUSTOM_BACKGROUND_SOURCE_BYTES + 1 })),
    ).rejects.toThrow(CustomBackgroundError)
  })

  it('refuse un fichier illisible comme image (createImageBitmap échoue)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('format invalide')))
    await expect(processCustomBackgroundFile(makeFile())).rejects.toThrow(CustomBackgroundError)
  })
})

describe('processCustomBackgroundFile — redimensionnement et encodage (lot 3)', () => {
  beforeEach(() => {
    mockCanvas(50_000)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('redimensionne une image plus grande que 2560px sur son plus grand côté', async () => {
    mockImageBitmap(5120, 2560)
    const blob = await processCustomBackgroundFile(makeFile())
    expect(blob.type).toBe('image/webp')
  })

  it('ne redimensionne pas une image déjà sous la limite', async () => {
    mockImageBitmap(800, 600)
    const blob = await processCustomBackgroundFile(makeFile())
    expect(blob.type).toBe('image/webp')
  })

  it('refuse le résultat si, malgré tout, le fichier encodé reste trop lourd', async () => {
    mockCanvas(MAX_CUSTOM_BACKGROUND_OUTPUT_BYTES + 1)
    mockImageBitmap(MAX_CUSTOM_BACKGROUND_DIMENSION, MAX_CUSTOM_BACKGROUND_DIMENSION)
    await expect(processCustomBackgroundFile(makeFile())).rejects.toThrow(CustomBackgroundError)
  })
})
