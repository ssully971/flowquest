export interface ChangelogEntry {
  version: string
  date: string
  text: string
}

/**
 * Journal des versions (§7.9 et §12 du cahier des charges) : à terme rédigé depuis le
 * panneau Admin (table `changelog`, hors périmètre de cette phase) ; en attendant, géré
 * ici côté client. La première entrée (la plus récente) détermine la version affichée
 * dans Support et le déclenchement du badge « nouveau » — garde-la synchronisée avec
 * src/shared/app-version.ts à chaque ajout.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.3.0',
    date: '2026-10-17',
    text: 'Réglages Horloge, Minuteur, Citations, Extras, Support et Nouveautés : format et style de l’horloge, durées et démarrage automatique du minuteur, citations avec rotation, nom affiché, mode épuré, thème aléatoire, formulaire de contact, et ce journal des versions.',
  },
]
