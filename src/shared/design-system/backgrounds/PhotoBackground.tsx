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
      {/* Scrim : une photo n'est jamais conçue, contrairement aux fonds en CSS, pour garantir
          le contraste du texte/des commandes posés par-dessus (§20 du cahier des charges).
          Assombrit surtout le bas de l'écran, où vivent la barre de commandes et les
          libellés, sans assombrir le haut qui reste généralement plus dégagé. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.14) 35%, rgba(0,0,0,0) 62%)',
        }}
      />
    </div>
  )
}
