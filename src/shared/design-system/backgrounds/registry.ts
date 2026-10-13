import type { ComponentType } from 'react'

import { AubergineBackground } from './AubergineBackground'
import { BrumeBackground } from './BrumeBackground'
import { ContoursBackground } from './ContoursBackground'
import { HorizonBackground } from './HorizonBackground'
import { StriesBackground } from './StriesBackground'

export type BackgroundId = 'horizon' | 'contours' | 'aubergine' | 'brume' | 'stries'

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
]

export const BACKGROUND_IDS: BackgroundId[] = BACKGROUNDS.map((bg) => bg.id)

export function getBackgroundDefinition(id: BackgroundId): BackgroundDefinition {
  return BACKGROUNDS.find((bg) => bg.id === id) ?? BACKGROUNDS[0]
}
