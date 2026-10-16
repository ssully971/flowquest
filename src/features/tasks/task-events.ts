const listeners = new Set<() => void>()

export function notifyTasksChanged(): void {
  listeners.forEach((listener) => listener())
}

export function onTasksChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
