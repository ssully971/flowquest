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
import { HorizonBackground } from './HorizonBackground'
import { RespirationBackground } from './RespirationBackground'
import { SilhouettesBackground } from './SilhouettesBackground'
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

export type BackgroundCategory =
  'gradients' | 'abstract' | 'scenic' | 'nature' | 'urban' | 'interior' | 'animated'

export interface BackgroundDefinition {
  id: BackgroundId
  label: string
  category: BackgroundCategory
  Component: ComponentType
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
]

export const BACKGROUND_IDS: BackgroundId[] = BACKGROUNDS.map((bg) => bg.id)

export function getBackgroundDefinition(id: BackgroundId): BackgroundDefinition {
  return BACKGROUNDS.find((bg) => bg.id === id) ?? BACKGROUNDS[0]
}
