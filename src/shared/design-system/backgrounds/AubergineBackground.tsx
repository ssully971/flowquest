import { ContourPattern } from './ContourPattern'

export function AubergineBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        background:
          'linear-gradient(160deg, var(--tone-a) 0%, var(--tone-b) 55%, var(--tone-c) 100%)',
      }}
    >
      <ContourPattern opacity={0.5} />
    </div>
  )
}
