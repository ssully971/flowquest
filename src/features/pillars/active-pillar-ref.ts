// Accesseur mutable lu par du code hors React (session-recorder.ts, pour attacher le
// pilier actif à la session enregistrée). ActivePillarProvider le tient à jour — même
// principe que active-task-ref.ts.
let activePillarId: string | null = null

export function getActivePillarId(): string | null {
  return activePillarId
}

export function setActivePillarIdRef(id: string | null): void {
  activePillarId = id
}
