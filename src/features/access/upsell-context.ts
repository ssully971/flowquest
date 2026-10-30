import { createContext } from 'react'

import type { LockableFeature } from './feature-access'

export interface UpsellValue {
  isOpen: boolean
  feature: LockableFeature | null
  openUpsell: (feature: LockableFeature) => void
  closeUpsell: () => void
}

// Valeur par défaut sans effet (comme AuthGateRequestContext) : les composants montés
// isolément dans les tests n'ont pas besoin du fournisseur.
const noopValue: UpsellValue = {
  isOpen: false,
  feature: null,
  openUpsell: () => {},
  closeUpsell: () => {},
}

export const UpsellContext = createContext<UpsellValue>(noopValue)
