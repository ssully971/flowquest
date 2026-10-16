export function DeriveBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(120deg, var(--tone-a), var(--tone-c), var(--tone-b), var(--tone-c), var(--tone-a))',
        backgroundSize: '300% 300%',
        animation: 'bg-drift 18s ease-in-out infinite',
      }}
    />
  )
}
