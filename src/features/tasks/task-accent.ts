import { contrastRatio } from '@/features/home/clock-color-contrast'

/** Couleur du « ✓ » posé sur un aplat de la couleur du pilier : blanc ou encre, selon le
 * meilleur contraste (les couleurs de piliers vont du jaune clair au gris moyen). */
export function readableOn(background: string): string {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#14110e')
    ? '#ffffff'
    : '#14110e'
}
