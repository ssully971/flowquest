// Accesseur mutable partagé : plusieurs dépôts/singletons créés avant que l'état de
// connexion soit connu (SyncingTimerStateRepository, l'enregistreur de sessions) le
// lisent dynamiquement plutôt que de le recevoir figé à la construction.
let userId: string | null = null

export function getCurrentUserId(): string | null {
  return userId
}

export function setCurrentUserId(next: string | null): void {
  userId = next
}
