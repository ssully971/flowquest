import { ContourPattern } from './ContourPattern'

export function BrumeBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(85% 60% at 50% -10%, var(--glow) 0%, transparent 70%)',
        }}
      />
      <ContourPattern opacity={0.35} />
    </div>
  )
}
