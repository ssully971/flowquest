export const PANEL_DISPLAY_MODES = ['panel', 'window'] as const
export type PanelDisplayMode = (typeof PANEL_DISPLAY_MODES)[number]
