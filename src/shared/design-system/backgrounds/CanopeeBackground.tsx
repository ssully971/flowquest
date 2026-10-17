export function CanopeeBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        background: 'var(--bg)',
        backgroundImage:
          'repeating-radial-gradient(circle at 20% 20%, var(--contour) 0px, var(--contour) 2px, transparent 3px, transparent 46px)',
      }}
    />
  )
}
