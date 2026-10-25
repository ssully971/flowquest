const listeners = new Set<() => void>()

export function notifyPillarsChanged(): void {
  listeners.forEach((listener) => listener())
}

export function onPillarsChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
