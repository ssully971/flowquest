import { strings } from '@/shared/i18n'

import { useResolvedTheme } from './useResolvedTheme'

export type LogoVariant = 'mark' | 'wordmark'
export type LogoTone = 'auto' | 'panel'

interface LogoProps {
  /** `mark` : seule l'icône de la marque (tête de renard). `wordmark` (défaut) : le texte « Fokitsu ». */
  variant?: LogoVariant
  /**
   * `auto` (défaut) : blanc en thème sombre, noir en thème clair (fonds pleins, comme
   * l'accueil). `panel` : pour un fond neutre (panneau Réglages) — version bleu nuit en
   * clair (contraste ≈ 10:1 sur le panneau), blanche en sombre : le bleu nuit n'atteint
   * que ≈ 1,7:1 sur le panneau sombre.
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
        ? SRC.wordmarkWhite
        : SRC.wordmarkColor
      : isDark
        ? SRC.wordmarkWhite
        : SRC.wordmarkBlack

  return <img src={src} alt={strings.app.name} className={className} />
}
