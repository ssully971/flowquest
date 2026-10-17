import type { QuoteCategory, QuoteRotation } from './quotes'

export interface QuotesSettings {
  showOnHome: boolean
  showOnFocus: boolean
  rotation: QuoteRotation
  category: QuoteCategory | 'all'
}

export const DEFAULT_QUOTES_SETTINGS: QuotesSettings = {
  showOnHome: true,
  showOnFocus: false,
  rotation: 'daily',
  category: 'all',
}
