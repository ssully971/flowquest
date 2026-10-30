import type { ComponentType } from 'react'

import { AubergineBackground } from './AubergineBackground'
import { BrumeBackground } from './BrumeBackground'
import { CanopeeBackground } from './CanopeeBackground'
import { ContoursBackground } from './ContoursBackground'
import { DeriveBackground } from './DeriveBackground'
import { DunesBackground } from './DunesBackground'
import { FenetreBackground } from './FenetreBackground'
import { FeuillageBackground } from './FeuillageBackground'
import { GrilleBackground } from './GrilleBackground'
import { CustomBackground } from './CustomBackground'
import { HorizonBackground } from './HorizonBackground'
import { PHOTO_BACKGROUNDS } from './photo-backgrounds'
import { RespirationBackground } from './RespirationBackground'
import { SilhouettesBackground } from './SilhouettesBackground'
import { PureBlackBackground, PureWhiteBackground } from './SolidBackground'
import { StriesBackground } from './StriesBackground'
import { SummitsBackground } from './SummitsBackground'
import { TapisBackground } from './TapisBackground'

export type BackgroundId =
  | 'horizon'
  | 'contours'
  | 'aubergine'
  | 'brume'
  | 'stries'
  | 'summits'
  | 'dunes'
  | 'feuillage'
  | 'canopee'
  | 'silhouettes'
  | 'grille'
  | 'fenetre'
  | 'tapis'
  | 'respiration'
  | 'derive'
  | 'photo-aurore'
  | 'photo-braise'
  | 'photo-emeraude'
  | 'photo-azur'
  | 'photo-barbapapa'
  | 'photo-corail'
  | 'photo-lueur'
  | 'photo-opaline'
  | 'photo-fjord'
  | 'photo-torrent'
  | 'photo-ruban'
  | 'photo-confettis'
  | 'photo-cretes'
  | 'photo-desert'
  | 'photo-nebuleuse'
  | 'photo-velours'
  | 'photo-eclipse'
  | 'photo-spectre'
  | 'photo-prisme'
  | 'photo-agate'
  | 'photo-brouillard'
  | 'photo-pirogue'
  | 'photo-pourpre'
  | 'photo-envol'
  | 'photo-foyer'
  | 'photo-lac-bleu'
  | 'photo-chalet-enneige'
  | 'photo-cerf-neiges'
  | 'photo-crete-mauve'
  | 'photo-veillee-lac'
  | 'photo-foret-aquarelle'
  | 'photo-ardoise'
  | 'photo-pleine-lune'
  | 'pure-black'
  | 'pure-white'
  | 'custom'

export type BackgroundCategory =
  'gradients' | 'abstract' | 'scenic' | 'nature' | 'urban' | 'interior' | 'animated' | 'minimal'

export interface BackgroundDefinition {
  id: BackgroundId
  label: string
  category: BackgroundCategory
  Component: ComponentType
  /** Rendu léger pour les vignettes de la bibliothèque (lot 3) : par défaut, retombe sur
   * `Component` (peu coûteux pour les fonds en CSS) ; les fonds photo fournissent une
   * vignette dédiée, chargée en différé (`loading="lazy"`), bien plus légère que la pleine
   * résolution. */
  Thumbnail?: ComponentType
  /** Thème pour lequel ce fond est pensé (lot 3) : les fonds photo n'en ont qu'un ; les
   * fonds en CSS s'adaptent déjà automatiquement aux jetons de couleur du thème actif. */
  suggestedTheme?: 'dark' | 'light'
  /** `false` pour un fond jugé trop chargé en mode Ambiant (texte/minuteur par-dessus). */
  usableInAmbient?: boolean
  credit?: string
  /** Image statique légère de ce fond (fonds photo) : pour les rendus qui ne peuvent pas monter
   * le composant — fenêtre Picture-in-Picture, vignettes. Absente pour les fonds en CSS. */
  staticSrc?: string
}

export const BACKGROUNDS: BackgroundDefinition[] = [
  { id: 'horizon', label: 'Horizon', category: 'gradients', Component: HorizonBackground },
  { id: 'aubergine', label: 'Aubergine', category: 'gradients', Component: AubergineBackground },
  { id: 'brume', label: 'Brume', category: 'abstract', Component: BrumeBackground },
  { id: 'contours', label: 'Contours', category: 'abstract', Component: ContoursBackground },
  { id: 'stries', label: 'Stries', category: 'abstract', Component: StriesBackground },
  { id: 'summits', label: 'Sommets', category: 'scenic', Component: SummitsBackground },
  { id: 'dunes', label: 'Dunes', category: 'scenic', Component: DunesBackground },
  { id: 'feuillage', label: 'Feuillage', category: 'nature', Component: FeuillageBackground },
  { id: 'canopee', label: 'Canopée', category: 'nature', Component: CanopeeBackground },
  { id: 'silhouettes', label: 'Silhouettes', category: 'urban', Component: SilhouettesBackground },
  { id: 'grille', label: 'Grille', category: 'urban', Component: GrilleBackground },
  { id: 'fenetre', label: 'Fenêtre', category: 'interior', Component: FenetreBackground },
  { id: 'tapis', label: 'Tapis', category: 'interior', Component: TapisBackground },
  {
    id: 'respiration',
    label: 'Respiration',
    category: 'animated',
    Component: RespirationBackground,
  },
  { id: 'derive', label: 'Dérive', category: 'animated', Component: DeriveBackground },
  ...PHOTO_BACKGROUNDS,
  {
    id: 'pure-black',
    label: 'Noir pur',
    category: 'minimal',
    suggestedTheme: 'dark',
    Component: PureBlackBackground,
  },
  {
    id: 'pure-white',
    label: 'Blanc pur',
    category: 'minimal',
    suggestedTheme: 'light',
    Component: PureWhiteBackground,
  },
  // Fond personnel (lot 3) : jamais affiché dans la grille de la bibliothèque (exclu
  // explicitement par id dans ThemesPage, pas par catégorie), seulement sélectionnable une
  // fois une image envoyée, depuis sa propre section « Fond personnel ».
  { id: 'custom', label: 'Fond personnel', category: 'gradients', Component: CustomBackground },
]

export const BACKGROUND_IDS: BackgroundId[] = BACKGROUNDS.map((bg) => bg.id)

export function getBackgroundDefinition(id: BackgroundId): BackgroundDefinition {
  return BACKGROUNDS.find((bg) => bg.id === id) ?? BACKGROUNDS[0]
}
