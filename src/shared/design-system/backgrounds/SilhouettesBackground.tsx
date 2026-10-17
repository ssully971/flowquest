const BUILDINGS = [
  { left: '2%', width: '9%', height: '28%' },
  { left: '12%', width: '7%', height: '42%' },
  { left: '20%', width: '11%', height: '20%' },
  { left: '32%', width: '8%', height: '50%' },
  { left: '41%', width: '10%', height: '32%' },
  { left: '52%', width: '7%', height: '60%' },
  { left: '60%', width: '12%', height: '24%' },
  { left: '73%', width: '9%', height: '44%' },
  { left: '83%', width: '8%', height: '30%' },
  { left: '92%', width: '7%', height: '52%' },
]

export function SilhouettesBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {BUILDINGS.map((building, index) => (
        <div
          key={index}
          className="absolute bottom-0"
          style={{
            left: building.left,
            width: building.width,
            height: building.height,
            background: index % 2 === 0 ? 'var(--tone-b)' : 'var(--tone-a)',
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  )
}
