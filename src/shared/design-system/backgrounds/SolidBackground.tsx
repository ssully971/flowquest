interface SolidBackgroundProps {
  color: '#000000' | '#ffffff'
}

/**
 * Fonds « Minimal » (lot 3 bis, §3.4) : noir pur OLED et blanc pur, en couleur fixe plutôt
 * que des jetons de thème — c'est tout l'intérêt (vrai noir OLED quel que soit le thème actif,
 * contrairement aux fonds en CSS qui suivent --tone-*).
 */
export function SolidBackground({ color }: SolidBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={{ background: color }}
    />
  )
}

export function PureBlackBackground() {
  return <SolidBackground color="#000000" />
}

export function PureWhiteBackground() {
  return <SolidBackground color="#ffffff" />
}
