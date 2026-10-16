export function GrilleBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        background: 'var(--bg)',
        backgroundImage:
          'repeating-linear-gradient(0deg, var(--contour) 0px, var(--contour) 1px, transparent 1px, transparent 64px), repeating-linear-gradient(90deg, var(--contour) 0px, var(--contour) 1px, transparent 1px, transparent 64px)',
      }}
    />
  )
}
