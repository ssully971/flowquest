// Accesseur mutable lu par du code hors React (session-recorder.ts, pour savoir s'il doit
// rattacher le pilier actif à la session enregistrée). ExtrasSettingsProvider le tient à
// jour — même principe que active-pillar-ref.ts. Vrai par défaut : les piliers sont
// activés tant que ce module n'a pas encore été mis à jour par le Provider (ex. tout
// premier rendu), cohérent avec DEFAULT_EXTRAS_SETTINGS.pillarsEnabled.
let pillarsEnabled = true

export function getPillarsEnabled(): boolean {
  return pillarsEnabled
}

export function setPillarsEnabledRef(enabled: boolean): void {
  pillarsEnabled = enabled
}
