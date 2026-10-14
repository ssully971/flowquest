const listeners = new Set<() => void>()

export function notifySessionRecorded(): void {
  listeners.forEach((listener) => listener())
}

export function onSessionRecorded(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
