export function FenetreBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--horizon)' }}
    >
      <div
        className="absolute inset-[8%] border"
        style={{ borderColor: 'var(--contour)', borderWidth: '10px' }}
      >
        <div
          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
          style={{ background: 'var(--contour)' }}
        />
        <div
          className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2"
          style={{ background: 'var(--contour)' }}
        />
      </div>
    </div>
  )
}
