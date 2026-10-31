/**
 * Demandes adressées à l'application depuis un écran qui n'en possède pas les panneaux (la
 * constellation) : ouvrir le panneau des tâches, ou lancer un focus sur une tâche. AppShell
 * écoute, FocusScreen consomme la demande de focus une fois son minuteur prêt et au repos.
 */
const openTasksListeners = new Set<() => void>()
const focusListeners = new Set<(taskId: string) => void>()
const focusAvailabilityListeners = new Set<() => void>()
let pendingFocusTaskId: string | null = null

export function requestOpenTasks(): void {
  openTasksListeners.forEach((listener) => listener())
}

export function onOpenTasksRequested(listener: () => void): () => void {
  openTasksListeners.add(listener)
  return () => openTasksListeners.delete(listener)
}

/** Demande de démarrer une session de focus sur `taskId` (écran Focus, minuteur au repos). */
export function requestFocusOnTask(taskId: string): void {
  pendingFocusTaskId = taskId
  focusListeners.forEach((listener) => listener(taskId))
  focusAvailabilityListeners.forEach((listener) => listener())
}

/** Consomme la demande en attente (une seule fois) ; `null` s'il n'y en a pas. */
export function takePendingFocusRequest(): string | null {
  const taskId = pendingFocusTaskId
  pendingFocusTaskId = null
  return taskId
}

export function peekPendingFocusRequest(): string | null {
  return pendingFocusTaskId
}

/** AppShell : choisir la tâche (et son pilier) comme actifs, passer à l'écran Focus. */
export function onFocusRequested(listener: (taskId: string) => void): () => void {
  focusListeners.add(listener)
  return () => focusListeners.delete(listener)
}

/** FocusScreen : réessayer de démarrer dès qu'une demande arrive ou que le minuteur est prêt. */
export function onFocusRequestPending(listener: () => void): () => void {
  focusAvailabilityListeners.add(listener)
  return () => focusAvailabilityListeners.delete(listener)
}
