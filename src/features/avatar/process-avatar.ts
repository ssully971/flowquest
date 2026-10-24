export const AVATAR_OUTPUT_SIZE = 256
export const AVATAR_TARGET_BYTES = 40 * 1024
export const AVATAR_MAX_SOURCE_BYTES = 15 * 1024 * 1024

export class AvatarProcessingError extends Error {}

export interface CropTransform {
  naturalWidth: number
  naturalHeight: number
  viewportSize: number
  /** >= 1 : 1 = l'image couvre tout juste le cadre carré (comme object-fit: cover). */
  zoom: number
  /** Décalage en pixels CSS du cadre (même espace que viewportSize), positif = l'image se
   * déplace vers la droite/le bas. */
  panX: number
  panY: number
}

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** Rectangle à extraire de l'image source (coordonnées natives), à partir d'un cadrage
 * exprimé en pixels CSS d'aperçu (zoom + déplacement). Pure, testable sans DOM. */
export function computeCropRect(t: CropTransform): CropRect {
  const baseScale = t.viewportSize / Math.min(t.naturalWidth, t.naturalHeight)
  const effectiveScale = baseScale * t.zoom
  const displayedWidth = t.naturalWidth * effectiveScale
  const displayedHeight = t.naturalHeight * effectiveScale
  const centerOffsetX = (t.viewportSize - displayedWidth) / 2
  const centerOffsetY = (t.viewportSize - displayedHeight) / 2
  const originX = centerOffsetX + t.panX
  const originY = centerOffsetY + t.panY

  return {
    sx: -originX / effectiveScale,
    sy: -originY / effectiveScale,
    sw: t.viewportSize / effectiveScale,
    sh: t.viewportSize / effectiveScale,
  }
}

/** Empêche de déplacer l'image au point de laisser apparaître du vide dans le cadre
 * carré : le déplacement est borné à la moitié du débordement de chaque axe. */
export function clampPan(params: {
  naturalWidth: number
  naturalHeight: number
  viewportSize: number
  zoom: number
  panX: number
  panY: number
}): { panX: number; panY: number } {
  const baseScale = params.viewportSize / Math.min(params.naturalWidth, params.naturalHeight)
  const effectiveScale = baseScale * params.zoom
  const displayedWidth = params.naturalWidth * effectiveScale
  const displayedHeight = params.naturalHeight * effectiveScale
  const maxPanX = Math.max(0, (displayedWidth - params.viewportSize) / 2)
  const maxPanY = Math.max(0, (displayedHeight - params.viewportSize) / 2)

  return {
    panX: Math.min(maxPanX, Math.max(-maxPanX, params.panX)),
    panY: Math.min(maxPanY, Math.max(-maxPanY, params.panY)),
  }
}

export async function loadAvatarImageBitmap(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new AvatarProcessingError('Choisis un fichier image (JPEG, PNG, WebP…).')
  }
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    throw new AvatarProcessingError('Cette image est trop lourde (15 Mo maximum).')
  }
  try {
    return await createImageBitmap(file)
  } catch {
    throw new AvatarProcessingError('Impossible de lire cette image. Essaie un autre fichier.')
  }
}

const QUALITY_STEPS = [0.8, 0.65, 0.5, 0.35, 0.2]

/** Essaie plusieurs niveaux de qualité décroissants jusqu'à passer sous la taille cible ;
 * renvoie le meilleur résultat obtenu sinon. `blob.type` confirme que le navigateur a
 * vraiment encodé dans le format demandé (un navigateur sans support WebP renvoie
 * souvent un PNG silencieusement plutôt que d'échouer) — c'est ce qui déclenche le repli
 * JPEG dans cropAndEncodeAvatar(). */
async function encodeWithSizeTarget(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  targetBytes: number,
): Promise<Blob | null> {
  let best: Blob | null = null
  for (const quality of QUALITY_STEPS) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality))
    if (!blob || blob.type !== mimeType) return null
    best = blob
    if (blob.size <= targetBytes) return blob
  }
  return best
}

export interface ProcessedAvatar {
  blob: Blob
  extension: 'webp' | 'jpg'
  mimeType: 'image/webp' | 'image/jpeg'
}

/** Recadre (zoom + déplacement choisis par l'utilisateur) puis réduit à 256×256, encodé
 * en WebP qualité ~0,8 visant ≤ 40 Ko (repli JPEG si le navigateur ne sait pas exporter de
 * WebP). Le passage par canvas supprime les métadonnées EXIF (jamais préservées par
 * drawImage + toBlob) — rien à faire de plus pour ça. */
export async function cropAndEncodeAvatar(
  bitmap: ImageBitmap,
  transform: Pick<CropTransform, 'viewportSize' | 'zoom' | 'panX' | 'panY'>,
): Promise<ProcessedAvatar> {
  const rect = computeCropRect({
    naturalWidth: bitmap.width,
    naturalHeight: bitmap.height,
    ...transform,
  })

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_OUTPUT_SIZE
  canvas.height = AVATAR_OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new AvatarProcessingError('Le navigateur ne permet pas de traiter cette image.')
  }
  ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE)

  const webp = await encodeWithSizeTarget(canvas, 'image/webp', AVATAR_TARGET_BYTES)
  if (webp) return { blob: webp, extension: 'webp', mimeType: 'image/webp' }

  const jpeg = await encodeWithSizeTarget(canvas, 'image/jpeg', AVATAR_TARGET_BYTES)
  if (!jpeg) throw new AvatarProcessingError('L’export de l’image a échoué. Réessaie.')
  return { blob: jpeg, extension: 'jpg', mimeType: 'image/jpeg' }
}
