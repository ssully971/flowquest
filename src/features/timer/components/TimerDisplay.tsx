interface TimerDisplayProps {
  label: string
}

export function TimerDisplay({ label }: TimerDisplayProps) {
  const parts = label.split(':')

  return (
    <div
      className="font-extrabold text-[var(--text)]"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(64px, 18vw, 176px)',
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
