import { photoIdFromBackgroundId } from '@/features/settings/custom-photos'
import { getBackgroundDefinition } from '@/shared/design-system'
import type { BackgroundId } from '@/shared/design-system'

/**
 * Fond de la fenêtre Picture-in-Picture : une version STATIQUE du fond d'écran choisi, jamais un
 * canvas lourd ni un composant animé recopié dans une autre fenêtre.
 *  - fond photo : sa vignette (≈ 480 px, bien assez pour une fenêtre de 240 × 140) ;
 *  - photo personnelle : son URL d'objet (même origine, donc lisible depuis la fenêtre PiP) ;
 *  - fond en CSS (dégradés, motifs, animés) : un dégradé équivalent tiré des couleurs du thème
 *    actif — les variables CSS n'existent pas dans la fenêtre PiP, on passe donc des couleurs
 *    déjà résolues.
 */
export interface PipBackground {
  /** URL de l'image (`null` : dégradé seul). */
  imageSrc: string | null
  /** `object-position` / `background-position` de l'image. */
  position: string
  colorFrom: string
  colorTo: string
}

export interface ThemeColors {
  bg: string
  surface2: string
}

const FALLBACK_COLORS: ThemeColors = { bg: '#0c0719', surface2: '#291d47' }

/** Couleurs du thème actif, lues sur le document principal (valeurs concrètes, pas var(--…)). */
export function readThemeColors(): ThemeColors {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function')
    return FALLBACK_COLORS
  const style = getComputedStyle(document.documentElement)
  return {
    bg: style.getPropertyValue('--bg').trim() || FALLBACK_COLORS.bg,
    surface2: style.getPropertyValue('--surface-2').trim() || FALLBACK_COLORS.surface2,
  }
}

const POSITIONS = { top: 'center top', center: 'center center', bottom: 'center bottom' } as const

export function resolvePipBackground(
  id: BackgroundId,
  options: {
    /** Photo de la bibliothèque personnelle quand `id` en désigne une (`custom:<id>`). */
    customPhoto?: { url: string; position: keyof typeof POSITIONS } | null
    colors?: ThemeColors
  },
): PipBackground {
  const colors = options.colors ?? readThemeColors()
  const base = { colorFrom: colors.bg, colorTo: colors.surface2 }
  if (photoIdFromBackgroundId(id) !== null) {
    return {
      ...base,
      imageSrc: options.customPhoto?.url ?? null,
      position: POSITIONS[options.customPhoto?.position ?? 'center'],
    }
  }
  const definition = getBackgroundDefinition(id)
  return { ...base, imageSrc: definition.staticSrc ?? null, position: 'center center' }
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

/** Charge (une seule fois) l'image d'un fond pour le dessin canvas ; `null` si elle ne charge pas. */
export function loadPipImage(src: string): Promise<HTMLImageElement | null> {
  let cached = imageCache.get(src)
  if (!cached) {
    cached = new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = src
    })
    imageCache.set(src, cached)
  }
  return cached
}
