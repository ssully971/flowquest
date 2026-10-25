function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return [r, g, b]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Ratio de contraste WCAG entre deux couleurs hex (1 à 21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA))
  const luminanceB = relativeLuminance(hexToRgb(hexB))
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

// Seuil requis par le lot 3 bis, §5 (plus strict que le minimum AA texte large de 3:1,
// §1.4.3 WCAG) : 4,5:1, le seuil AA texte normal, pour une marge plus confortable vu la
// variété de fonds sur lesquels l'horloge peut s'afficher.
export const CLOCK_CONTRAST_WARNING_THRESHOLD = 4.5

// Doit rester synchronisé avec --surface dans src/shared/design-system/tokens.css.
const THEME_SURFACE_HEX: Record<'light' | 'dark', string> = {
  light: '#f8f4ff',
  dark: '#1c1330',
}

/**
 * Avertissement honnête : l'horloge s'affiche sur des fonds photo/dégradé très variables,
 * donc on ne peut pas mesurer le contraste réel pixel par pixel. On compare la couleur
 * choisie à la teinte de base du thème courant (var(--surface)) comme indicateur
 * raisonnable, pas comme garantie absolue.
 */
export function isLowContrast(clockColorHex: string, resolvedTheme: 'light' | 'dark'): boolean {
  return contrastRatio(clockColorHex, THEME_SURFACE_HEX[resolvedTheme]) < CLOCK_CONTRAST_WARNING_THRESHOLD
}
