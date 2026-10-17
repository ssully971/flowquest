import type { BackgroundCategory, BackgroundDefinition, BackgroundId } from './registry'
import { PhotoBackground } from './PhotoBackground'

interface PhotoBackgroundSpec {
  id: BackgroundId
  label: string
  category: BackgroundCategory
  folder: string
  file: string
  suggestedTheme?: 'dark' | 'light'
  usableInAmbient: boolean
  credit?: string
}

/**
 * Catalogue des fonds photo ajoutés au lot 3 (dégradés sombres/clairs, paysages, abstrait —
 * voir docs/CAHIER_DES_CHARGES.md §20.5 pour les fonds en CSS existants, inchangés). Les
 * fichiers sources vivent dans public/backgrounds/<dossier>/ (pleine résolution, ~1920px) et
 * public/backgrounds/<dossier>/thumbs/ (vignettes ~480px, pour la bibliothèque).
 */
const PHOTO_BACKGROUND_SPECS: PhotoBackgroundSpec[] = [
  // Dégradés sombres
  {
    id: 'photo-aurore',
    label: 'Aurore',
    category: 'gradients',
    folder: 'dark-gradients',
    file: 'aurore.webp',
    suggestedTheme: 'dark',
    usableInAmbient: true,
  },
  {
    id: 'photo-braise',
    label: 'Braise',
    category: 'gradients',
    folder: 'dark-gradients',
    file: 'braise.webp',
    suggestedTheme: 'dark',
    usableInAmbient: true,
  },
  {
    id: 'photo-emeraude',
    label: 'Émeraude',
    category: 'gradients',
    folder: 'dark-gradients',
    file: 'emeraude.webp',
    suggestedTheme: 'dark',
    usableInAmbient: true,
  },
  // Dégradés clairs
  {
    id: 'photo-azur',
    label: 'Azur',
    category: 'gradients',
    folder: 'light-gradients',
    file: 'azur.webp',
    suggestedTheme: 'light',
    usableInAmbient: true,
  },
  {
    id: 'photo-barbapapa',
    label: 'Barbapapa',
    category: 'gradients',
    folder: 'light-gradients',
    file: 'barbapapa.webp',
    suggestedTheme: 'light',
    usableInAmbient: true,
  },
  {
    id: 'photo-corail',
    label: 'Corail',
    category: 'gradients',
    folder: 'light-gradients',
    file: 'corail.webp',
    suggestedTheme: 'light',
    usableInAmbient: true,
  },
  {
    id: 'photo-lueur',
    label: 'Lueur',
    category: 'gradients',
    folder: 'light-gradients',
    file: 'lueur.webp',
    suggestedTheme: 'light',
    usableInAmbient: true,
  },
  {
    id: 'photo-opaline',
    label: 'Opaline',
    category: 'gradients',
    folder: 'light-gradients',
    file: 'opaline.webp',
    suggestedTheme: 'light',
    usableInAmbient: true,
  },
  // Paysages
  {
    id: 'photo-fjord',
    label: 'Fjord',
    category: 'scenic',
    folder: 'scenic',
    file: 'fjord.webp',
    usableInAmbient: true,
  },
  {
    id: 'photo-torrent',
    label: 'Torrent',
    category: 'scenic',
    folder: 'scenic',
    file: 'torrent.webp',
    usableInAmbient: true,
  },
  // Abstrait
  {
    id: 'photo-ruban',
    label: 'Ruban',
    category: 'abstract',
    folder: 'abstract',
    file: 'ruban.webp',
    usableInAmbient: true,
  },
  {
    id: 'photo-confettis',
    label: 'Confettis',
    category: 'abstract',
    folder: 'abstract',
    file: 'confettis.webp',
    // Motif chargé : distrait en fond d'écran Ambiant, où le minuteur doit rester lisible.
    usableInAmbient: false,
  },
  {
    id: 'photo-cretes',
    label: 'Crêtes',
    category: 'abstract',
    folder: 'abstract',
    file: 'sommets.webp',
    usableInAmbient: true,
  },
  {
    id: 'photo-desert',
    label: 'Désert',
    category: 'abstract',
    folder: 'abstract',
    file: 'dunes.webp',
    usableInAmbient: true,
  },
]

export const PHOTO_BACKGROUND_IDS: BackgroundId[] = PHOTO_BACKGROUND_SPECS.map((spec) => spec.id)

export const PHOTO_BACKGROUNDS: BackgroundDefinition[] = PHOTO_BACKGROUND_SPECS.map((spec) => {
  const fullSrc = `/backgrounds/${spec.folder}/${spec.file}`
  const thumbSrc = `/backgrounds/${spec.folder}/thumbs/${spec.file}`
  return {
    id: spec.id,
    label: spec.label,
    category: spec.category,
    suggestedTheme: spec.suggestedTheme,
    usableInAmbient: spec.usableInAmbient,
    credit: spec.credit,
    Component: () => <PhotoBackground src={fullSrc} />,
    Thumbnail: () => <PhotoBackground src={thumbSrc} lazy />,
  }
})
