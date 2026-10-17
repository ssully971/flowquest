export function DunesBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-x-[-10%] bottom-[-10%] h-[70%] rounded-[100%]"
        style={{ background: 'var(--tone-c)', opacity: 0.5 }}
      />
      <div
        className="absolute inset-x-[-10%] bottom-[-22%] h-[55%] rounded-[100%]"
        style={{ background: 'var(--tone-b)', opacity: 0.6 }}
      />
      <div
        className="absolute inset-x-[-10%] bottom-[-34%] h-[40%] rounded-[100%]"
        style={{ background: 'var(--tone-a)' }}
      />
    </div>
  )
}
