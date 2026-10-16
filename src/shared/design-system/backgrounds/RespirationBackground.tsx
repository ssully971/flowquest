export function RespirationBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--glow) 0%, transparent 70%)',
          animation: 'bg-breathe 6s ease-in-out infinite',
        }}
      />
    </div>
  )
}
