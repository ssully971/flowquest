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
    version: '0.12.0',
    date: '2026-11-01',
    text: 'Corrections et temps réel : le bug des salons (« room_id » ambigu) est corrigé, les demandes d’amis, encouragements et invitations de salon arrivent désormais en direct (toast discret), Amis et Salons expliquent clairement comment se connecter quand tu es invité·e, la durée d’un salon affiche sa valeur en direct avec un champ saisissable, et la suppression d’une tâche demande confirmation (réglable dans Extras, avec un « Annuler » de 5 s si tu la désactives).',
  },
  {
    version: '0.11.0',
    date: '2026-10-31',
    text: 'Galaxie de nœuds : un nouvel onglet dans Stats où chaque session de focus devient une étoile, reliée à celles du même jour, colorée par pilier — avec info-bulle au survol et filtres par période et par pilier.',
  },
  {
    version: '0.10.0',
    date: '2026-10-30',
    text: 'Piliers de Vie : rattache tes sessions de focus à un pilier (Travail, Sport, Études…) grâce à une pastille discrète à côté du titre, gagne de l’XP et des niveaux dans Réglages > Piliers, et retrouve ta carte « Équilibre » dans Stats.',
  },
  {
    version: '0.9.0',
    date: '2026-10-29',
    text: 'Deep Focus (option désactivée par défaut dans Réglages > Minuteur) : si tu quittes l’onglet pendant une session de focus, ton minuteur se met en pause pile à cet instant, avec un petit indicateur pendant qu’il est actif et un toast « Reprendre » à ton retour.',
  },
  {
    version: '0.8.0',
    date: '2026-10-28',
    text: 'Raccourcis clavier dans Focus et Ambiant (Espace, N, R, M, ? pour l’aide) et des citations qui changent à chaque nouvelle phase sur l’écran Focus, avec un léger fondu.',
  },
  {
    version: '0.7.0',
    date: '2026-10-27',
    text: 'Mode Amis (4/4) : série partagée avec chaque ami (une flamme sur la liste quand vous avez chacun complété une session le même jour) et une dernière passe de finitions sur tout le Mode Amis.',
  },
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
