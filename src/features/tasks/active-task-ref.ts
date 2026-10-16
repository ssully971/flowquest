// Accesseur mutable lu par du code hors React (session-recorder.ts, pour attacher la
// tâche active à la session enregistrée). ActiveTaskProvider le tient à jour.
let activeTaskId: string | null = null

export function getActiveTaskId(): string | null {
  return activeTaskId
}

export function setActiveTaskIdRef(id: string | null): void {
  activeTaskId = id
}
