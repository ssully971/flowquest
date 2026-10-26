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
    version: '0.18.0',
    date: '2026-11-07',
    text: 'Flowquest devient Fokitsu ! Nouveau nom, nouveau logo et nouvelle icône (un petit renard), sur l’application, les e-mails et l’écran d’accueil. Tes réglages, tes tâches et tes sessions sont conservés tels quels.',
  },
  {
    version: '0.17.0',
    date: '2026-11-06',
    text: 'Fokitsu passe en bêta fermée : on s’inscrit désormais avec un code d’invitation à usage unique (les comptes existants ne changent pas). Dans ton profil, une nouvelle section « Inviter un ami » te permet de générer des codes une fois ton compte assez ancien et ton temps de focus suffisant, avec ta progression pour y arriver.',
  },
  {
    version: '0.16.0',
    date: '2026-11-05',
    text: 'Huit nouveaux fonds d\'écran, des boutons qui se fondent dans le fond choisi (barre du bas, sélecteur de mode, contrôles du minuteur), les conditions d\'utilisation, la politique de confidentialité et les mentions légales (accessibles sans connexion), une case pour recevoir les nouveautés par e-mail (décochée par défaut), et une page À propos avec les crédits des photos et sons utilisés.',
  },
  {
    version: '0.15.0',
    date: '2026-11-04',
    text: 'Sons en boucle sans coupure (fondu enchaîné), la galaxie rejoint les Piliers (sous le radar, disposée en spirale avec un bras par pilier), des objectifs de niveau par pilier (avec le rythme de focus nécessaire pour les atteindre à temps), et un réglage pour désactiver entièrement les piliers de vie si tu préfères t’en passer.',
  },
  {
    version: '0.14.0',
    date: '2026-11-03',
    text: 'Fonds d’écran, couleurs et Deep Focus : 11 nouvelles photos triées par catégorie (dont une catégorie Minimal avec Noir pur et Blanc pur), une bibliothèque repensée avec rangées par catégorie et « Tout voir », un fond différent pour chaque thème (avec option « même fond pour les deux »), une palette de couleurs d’horloge plus douce et propre à chaque thème, et un écran de session ultra-minimal quand Deep Focus est actif (fond noir ou blanc pur, rien d’autre que le temps et deux boutons).',
  },
  {
    version: '0.13.0',
    date: '2026-11-02',
    text: 'Épuration et mobile : un seul point d’entrée vers Amis/Salons/Classement (la carte profil en haut de Réglages, avec une pastille sur l’engrenage s’il y a du nouveau), deux tailles d’horloge plus petites et une taille d’icônes réglable, les modes du minuteur deviennent des icônes, un léger effet au survol partout (souris uniquement), et l’écran Focus sur mobile adopte une mise en page épurée façon Flocus.',
  },
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
