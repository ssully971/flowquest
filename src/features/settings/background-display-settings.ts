export interface BackgroundDisplaySettings {
  /** 0 à 100. Converti en flou CSS (voir AppShell.tsx) : 0 = net, 100 = flou maximal. */
  blurPercent: number
}

export const DEFAULT_BACKGROUND_DISPLAY_SETTINGS: BackgroundDisplaySettings = {
  blurPercent: 0,
}

/** 100% de flou → 24px, un flou marqué mais qui laisse encore deviner le fond. */
export const MAX_BACKGROUND_BLUR_PX = 24

export function blurPercentToPx(blurPercent: number): number {
  return (blurPercent / 100) * MAX_BACKGROUND_BLUR_PX
}
