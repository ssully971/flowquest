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
    version: '0.6.0',
    date: '2026-10-26',
    text: 'Mode Amis (3/4) : salons de focus ensemble — invite jusqu’à 5 amis, minuteur partagé démarré par l’hôte, liste des présents en temps réel et transfert d’hôte automatique en cas d’absence.',
  },
  {
    version: '0.5.0',
    date: '2026-10-25',
    text: 'Mode Amis (2/4) : statut en direct sur la liste d’amis (en focus, en pause), encouragements avec cinq emojis, et un classement hebdomadaire entre amis avec ta position et un message d’encouragement.',
  },
  {
    version: '0.4.0',
    date: '2026-10-24',
    text: 'Mode Amis (1/4) : photo de profil avec recadrage, code ami et ajout par pseudo exact, liste d’amis et demandes, blocage et signalement, et un nouveau réglage « Amis et confidentialité » pour choisir ce que tes amis voient de toi.',
  },
  {
    version: '0.3.0',
    date: '2026-10-17',
    text: 'Réglages Horloge, Minuteur, Citations, Extras, Support et Nouveautés : format et style de l’horloge, durées et démarrage automatique du minuteur, citations avec rotation, nom affiché, mode épuré, thème aléatoire, formulaire de contact, et ce journal des versions.',
  },
]
