export function FeuillageBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute -left-[10%] -top-[15%] h-[60%] w-[60%] rounded-full"
        style={{ background: 'var(--glow)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute -bottom-[20%] -right-[10%] h-[70%] w-[70%] rounded-full"
        style={{ background: 'var(--tone-c)', opacity: 0.45, filter: 'blur(40px)' }}
      />
      <div
        className="absolute bottom-[10%] left-[15%] h-[35%] w-[35%] rounded-full"
        style={{ background: 'var(--tone-a)', opacity: 0.35, filter: 'blur(30px)' }}
      />
    </div>
  )
}
