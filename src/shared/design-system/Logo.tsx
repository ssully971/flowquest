import { strings } from '@/shared/i18n'

import { useResolvedTheme } from './useResolvedTheme'

export type LogoVariant = 'mark' | 'wordmark'
export type LogoTone = 'auto' | 'panel'

interface LogoProps {
  /** `mark` : seule l'icône chronomètre. `wordmark` (défaut) : le texte « flowquest ». */
  variant?: LogoVariant
  /**
   * `auto` (défaut) : blanc en thème sombre, noir en thème clair (fonds pleins, comme
   * l'accueil). `panel` : pour un fond neutre (panneau Réglages) — version colorée en
   * sombre, mais noire en clair : la version colorée (dégradé partant du quasi-blanc) ne
   * respecte pas le contraste AA sur le panneau clair, presque blanc lui aussi.
   */
  tone?: LogoTone
  className?: string
}

const SRC = {
  mark: '/brand/logo-icon.webp',
  wordmarkWhite: '/brand/logo-wordmark-white.webp',
  wordmarkBlack: '/brand/logo-wordmark-black.webp',
  wordmarkColor: '/brand/logo-wordmark-color.webp',
}

export function Logo({ variant = 'wordmark', tone = 'auto', className }: LogoProps) {
  const isDark = useResolvedTheme() === 'dark'

  if (variant === 'mark') {
    return <img src={SRC.mark} alt={strings.app.name} className={className} />
  }

  const src =
    tone === 'panel'
      ? isDark
        ? SRC.wordmarkColor
        : SRC.wordmarkBlack
      : isDark
        ? SRC.wordmarkWhite
        : SRC.wordmarkBlack

  return <img src={src} alt={strings.app.name} className={className} />
}
