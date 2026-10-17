interface PhotoBackgroundProps {
  src: string
  /** `true` pour les vignettes de la bibliothèque : chargement différé (uniquement si la
   * vignette entre dans la zone visible), jamais toutes en même temps. */
  lazy?: boolean
}

export function PhotoBackground({ src, lazy = false }: PhotoBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      <img
        src={src}
        alt=""
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  )
}
