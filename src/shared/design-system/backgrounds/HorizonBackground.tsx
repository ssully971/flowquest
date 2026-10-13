import { ContourPattern } from './ContourPattern'

export function HorizonBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--horizon)' }}
    >
      <ContourPattern />
    </div>
  )
}
