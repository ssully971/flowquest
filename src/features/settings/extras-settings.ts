import type { SettingsPageId } from './page-id'

export interface ExtrasSettings {
  displayName: string
  disableAnimatedThemes: boolean
  cleanMode: boolean
  preventSleep: boolean
  defaultSettingsTab: SettingsPageId
  themeRandomizer: boolean
}

export const DEFAULT_EXTRAS_SETTINGS: ExtrasSettings = {
  displayName: '',
  disableAnimatedThemes: false,
  cleanMode: false,
  preventSleep: false,
  defaultSettingsTab: 'themes',
  themeRandomizer: false,
}
