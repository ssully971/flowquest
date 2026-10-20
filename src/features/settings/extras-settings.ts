import type { SettingsPageId } from './page-id'

export const SETTINGS_PANEL_SIDES = ['left', 'right'] as const
export type SettingsPanelSide = (typeof SETTINGS_PANEL_SIDES)[number]

export interface ExtrasSettings {
  displayName: string
  disableAnimatedThemes: boolean
  cleanMode: boolean
  preventSleep: boolean
  defaultSettingsTab: SettingsPageId
  themeRandomizer: boolean
  showStreak: boolean
  settingsPanelSide: SettingsPanelSide
}

export const DEFAULT_EXTRAS_SETTINGS: ExtrasSettings = {
  displayName: '',
  disableAnimatedThemes: false,
  cleanMode: false,
  preventSleep: false,
  defaultSettingsTab: 'themes',
  themeRandomizer: false,
  showStreak: true,
  settingsPanelSide: 'left',
}
