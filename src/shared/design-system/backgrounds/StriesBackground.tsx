export function StriesBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        background: 'var(--bg)',
        backgroundImage:
          'repeating-linear-gradient(-35deg, var(--contour) 0px, var(--contour) 1.5px, transparent 1.5px, transparent 28px)',
      }}
    />
  )
}
