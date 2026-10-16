export function SummitsBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background: 'var(--tone-c)',
          clipPath:
            'polygon(0% 100%, 0% 55%, 20% 20%, 38% 48%, 55% 10%, 74% 42%, 100% 25%, 100% 100%)',
          opacity: 0.55,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background: 'var(--tone-b)',
          clipPath:
            'polygon(0% 100%, 0% 65%, 24% 30%, 46% 60%, 68% 25%, 86% 55%, 100% 38%, 100% 100%)',
          opacity: 0.7,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[26%]"
        style={{
          background: 'var(--tone-a)',
          clipPath: 'polygon(0% 100%, 0% 70%, 30% 35%, 52% 70%, 78% 30%, 100% 60%, 100% 100%)',
        }}
      />
    </div>
  )
}
