interface BigDigitsProps {
  label: string
  sizePx: number
  sizeScale?: number
  fontFamily?: string
  fontWeight?: number
  letterSpacing?: string
  fontStyle?: 'italic' | 'normal'
  flip?: boolean
  meridiem?: string
  /** Couleur personnalisée (Réglages > Horloge, LOT B10) — `undefined` garde le
   * comportement par défaut (var(--text), suit automatiquement le thème). */
  color?: string
  /** Chiffres en « Liquid Glass » (classe `.glass-digits`, global.css) ; ignore `color`. */
  glass?: boolean
}

export function BigDigits({
  label,
  sizePx,
  sizeScale = 1,
  fontFamily = 'var(--font-display)',
  fontWeight = 800,
  letterSpacing = '-0.04em',
  fontStyle = 'normal',
  flip = false,
  meridiem,
  color,
  glass = false,
}: BigDigitsProps) {
  const parts = label.split(':')
  const scaledSizePx = Math.round(sizePx * sizeScale)

  return (
    <div className="inline-flex items-baseline gap-2">
      <div
        data-testid="big-digits"
        className={glass ? 'glass-digits' : 'text-[var(--text)]'}
        style={{
          fontFamily,
          fontWeight,
          fontStyle,
          fontSize: `clamp(${Math.round(scaledSizePx * 0.36)}px, 18vw, ${scaledSizePx}px)`,
          letterSpacing,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          ...(color && !glass ? { color } : {}),
        }}
      >
        {parts.map((part, partIndex) => (
          <span key={partIndex}>
            {partIndex > 0 ? <span className="mx-[0.1em] text-[var(--accent)]">:</span> : null}
            {part.split('').map((digit, digitIndex) => (
              <span
                key={flip ? `${partIndex}-${digitIndex}-${digit}` : `${partIndex}-${digitIndex}`}
                className="inline-block"
                style={flip ? { animation: 'clock-flip 320ms ease-out' } : undefined}
              >
                {digit}
              </span>
            ))}
          </span>
        ))}
      </div>
      {meridiem ? (
        <span
          className="text-[var(--muted)]"
          style={{ fontSize: `clamp(14px, 3vw, ${Math.round(scaledSizePx * 0.18)}px)` }}
        >
          {meridiem}
        </span>
      ) : null}
    </div>
  )
}
