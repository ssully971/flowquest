interface BigDigitsProps {
  label: string
  sizePx: number
}

export function BigDigits({ label, sizePx }: BigDigitsProps) {
  const parts = label.split(':')

  return (
    <div
      className="font-extrabold text-[var(--text)]"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: `clamp(${Math.round(sizePx * 0.36)}px, 18vw, ${sizePx}px)`,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <span className="mx-[0.1em] text-[var(--accent)]">:</span> : null}
          {part}
        </span>
      ))}
    </div>
  )
}
