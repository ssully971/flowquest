const listeners = new Set<() => void>()

/** Liens ou positions modifiés (hook useTaskLinks, tirage distant à la connexion). */
export function notifyConstellationChanged(): void {
  listeners.forEach((listener) => listener())
}

export function onConstellationChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
