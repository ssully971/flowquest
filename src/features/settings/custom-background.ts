import { CUSTOM_PHOTO_THUMB_SIZE } from './custom-photos'

export type { CustomBackgroundPosition, CustomBackgroundRecord } from '@/shared/storage/db'

/** Avant traitement : rejette d'emblée un fichier manifestement trop lourd plutôt que de
 * laisser le navigateur ramer sur un canvas géant. */
export const MAX_CUSTOM_BACKGROUND_SOURCE_BYTES = 20 * 1024 * 1024
/** « Resize to max 2560px » : le plus grand côté de l'image ne dépasse jamais cette taille. */
export const MAX_CUSTOM_BACKGROUND_DIMENSION = 2560
/** Après encodage webp : filet de sécurité, en pratique jamais atteint à 2560px/qualité 0.85. */
export const MAX_CUSTOM_BACKGROUND_OUTPUT_BYTES = 8 * 1024 * 1024

export class CustomBackgroundError extends Error {}

/** Lit un fichier image côté client, le redimensionne à 2560px maximum sur le plus grand
 * côté, et l'encode en webp — jamais envoyé à un serveur, tout se passe dans le navigateur. */
export async function processCustomBackgroundFile(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new CustomBackgroundError('Choisis un fichier image (JPEG, PNG, WebP…).')
  }
  if (file.size > MAX_CUSTOM_BACKGROUND_SOURCE_BYTES) {
    throw new CustomBackgroundError('Cette image est trop lourde (20 Mo maximum).')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new CustomBackgroundError('Impossible de lire cette image. Essaie un autre fichier.')
  }

  try {
    const scale = Math.min(
      1,
      MAX_CUSTOM_BACKGROUND_DIMENSION / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new CustomBackgroundError('Le navigateur ne permet pas de traiter cette image.')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    )
    if (!blob) {
      throw new CustomBackgroundError('L’export de l’image a échoué. Réessaie.')
    }
    if (blob.size > MAX_CUSTOM_BACKGROUND_OUTPUT_BYTES) {
      throw new CustomBackgroundError('Cette image reste trop lourde une fois traitée. Essaie une autre photo.')
    }
    return blob
  } finally {
    bitmap.close()
  }
}

/** Vignette (≈ 320 px, webp) d'une image déjà traitée, pour la grille de la bibliothèque. En cas
 * d'échec de la réduction, l'image d'origine sert de vignette plutôt que de bloquer l'ajout. */
export async function createCustomBackgroundThumbnail(source: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(source)
    try {
      const scale = Math.min(1, CUSTOM_PHOTO_THUMB_SIZE / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return source
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.8),
      )
      return blob ?? source
    } finally {
      bitmap.close()
    }
  } catch {
    return source
  }
}
