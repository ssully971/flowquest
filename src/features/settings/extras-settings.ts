import type { PanelDisplayMode } from '@/shared/design-system'

import type { SettingsPageId } from './page-id'

export const SETTINGS_PANEL_SIDES = ['left', 'right'] as const
export type SettingsPanelSide = (typeof SETTINGS_PANEL_SIDES)[number]

// LOT H2, §2 : icônes plus petites et fines par défaut dans toute l'interface — ce
// réglage ne concerne que les boutons à icône génériques (IconButton, barre du bas et
// contrôles du minuteur), pas les icônes décoratives ni le gros bouton lecture/pause.
export const ICON_SIZES = ['small', 'medium', 'large'] as const
export type IconSize = (typeof ICON_SIZES)[number]

export interface ExtrasSettings {
  displayName: string
  disableAnimatedThemes: boolean
  cleanMode: boolean
  preventSleep: boolean
  defaultSettingsTab: SettingsPageId
  themeRandomizer: boolean
  showStreak: boolean
  settingsPanelSide: SettingsPanelSide
  tasksDisplayMode: PanelDisplayMode
  notesDisplayMode: PanelDisplayMode
  confirmTaskDeletion: boolean
  iconSize: IconSize
  /** Piliers de Vie (lot 4, §5) : désactivé, plus de sélecteur de pilier, de radar ni de
   * galaxie, plus de calcul d'XP affiché — les sessions continuent d'être enregistrées
   * normalement, sans pilier. Les données des piliers ne sont jamais supprimées, elles
   * réapparaissent telles quelles si ce réglage est réactivé. */
  pillarsEnabled: boolean
  /** Affiche le bouton des sons d'ambiance sur l'écran Focus (désactivé par défaut) ; le mode
   * Ambiant a toujours le sien. */
  showFocusSoundsButton: boolean
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
  tasksDisplayMode: 'panel',
  notesDisplayMode: 'panel',
  confirmTaskDeletion: true,
  iconSize: 'small',
  pillarsEnabled: true,
  showFocusSoundsButton: false,
}
