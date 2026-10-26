/**
 * Une photo n'est jamais conçue, contrairement aux fonds en CSS, pour garantir le contraste
 * du texte/des commandes posés par-dessus (§20 du cahier des charges). Assombrit surtout le
 * bas de l'écran, où vivent la barre de commandes et les libellés, et garde un voile léger
 * partout ailleurs (y compris en haut, où vit le logo) plutôt que de laisser le haut de
 * l'image totalement net.
 *
 * Limite connue : ce voile est uniforme, pas adapté à la luminosité réelle de chaque photo.
 * Une image très sombre en thème clair (texte foncé) peut rester difficile à lire — Fokitsu
 * ne fait pas d'analyse de luminance par image. Choisis plutôt une photo assez claire, ou
 * utilise le réglage de flou pour unifier le fond si besoin.
 */
export function BackgroundScrim() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.1) 62%, rgba(0,0,0,0.1) 100%)',
      }}
    />
  )
}
