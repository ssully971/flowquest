import type { CustomPhotoRecord } from '@/shared/storage/db'

/**
 * Bibliothèque de fonds personnels : plusieurs photos persistantes (IndexedDB), jamais envoyées à un
 * serveur. Plafonds raisonnables pour ne pas saturer le stockage du navigateur.
 */
export const CUSTOM_PHOTO_MAX_COUNT = 12
export const CUSTOM_PHOTO_MAX_BYTES = 40 * 1024 * 1024
/** Côté de la vignette de la grille. */
export const CUSTOM_PHOTO_THUMB_SIZE = 320

/** Identifiant de la photo issue de l'ancien fond personnel unique (migration douce). */
export const LEGACY_PHOTO_ID = 'legacy'

/** Les fonds personnels s'ajoutent au catalogue sous l'identifiant `custom:<id de la photo>`. */
export type CustomBackgroundId = `custom:${string}`

export function toCustomBackgroundId(photoId: string): CustomBackgroundId {
  return `custom:${photoId}`
}

/** Identifiant de photo d'un identifiant de fond ; `null` pour un fond du catalogue. L'ancien
 * identifiant `custom` (fond unique d'avant la bibliothèque) désigne la photo migrée. */
export function photoIdFromBackgroundId(backgroundId: string): string | null {
  if (backgroundId === 'custom') return LEGACY_PHOTO_ID
  return backgroundId.startsWith('custom:') && backgroundId.length > 'custom:'.length
    ? backgroundId.slice('custom:'.length)
    : null
}

export type PhotoLimit = 'count' | 'size'

/** Ajouter une photo de `incomingBytes` à la bibliothèque est-il permis ? Sinon, quelle limite. */
export function checkPhotoLimits(
  photos: Pick<CustomPhotoRecord, 'size'>[],
  incomingBytes: number,
): { ok: true } | { ok: false; limit: PhotoLimit } {
  if (photos.length >= CUSTOM_PHOTO_MAX_COUNT) return { ok: false, limit: 'count' }
  const used = photos.reduce((sum, photo) => sum + photo.size, 0)
  if (used + incomingBytes > CUSTOM_PHOTO_MAX_BYTES) return { ok: false, limit: 'size' }
  return { ok: true }
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}
