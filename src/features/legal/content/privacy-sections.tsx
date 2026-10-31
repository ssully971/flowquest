import { APP_NAME } from '@/shared/app-config'
import type { LegalSection } from '../components/LegalLayout'

export const PRIVACY_LAST_UPDATED = '26 octobre 2026'

export const PRIVACY_SECTIONS: LegalSection[] = [
  { id: 'qui', title: 'Qui nous sommes' },
  { id: 'jamais', title: 'Ce que nous ne faisons jamais' },
  { id: 'donnees', title: 'Données que nous traitons' },
  { id: 'finalites', title: 'Finalités et bases légales' },
  { id: 'sous-traitants', title: 'Sous-traitants' },
  { id: 'conservation', title: 'Durée de conservation' },
  { id: 'cookies', title: 'Cookies et stockage local' },
  { id: 'transferts', title: 'Transferts hors Union européenne' },
  { id: 'droits', title: 'Tes droits' },
  { id: 'administration', title: 'Consultation par l’administrateur' },
  { id: 'securite', title: 'Sécurité' },
  { id: 'modifications', title: 'Modifications de cette politique' },
  { id: 'contact', title: 'Contact et réclamation' },
]

export const DATA_CATEGORIES: { label: string; detail: string }[] = [
  {
    label: 'Compte',
    detail: 'adresse e-mail, pseudo, nom affiché (optionnel), photo de profil (optionnelle).',
  },
  {
    label: 'Sessions de focus',
    detail: 'durée, type (focus/pause), date et heure de début et de fin, complétude.',
  },
  { label: 'Tâches', detail: 'titres de tâches, état (faite ou non), sous-tâches, échéances.' },
  { label: 'Notes', detail: 'le contenu de ton bloc-notes personnel.' },
  {
    label: 'Réglages',
    detail: 'préférences d’apparence, de minuteur, de sons, de confidentialité, etc.',
  },
  {
    label: 'Amis',
    detail: 'demandes d’amitié envoyées ou reçues, liste d’amis, code ami.',
  },
  {
    label: 'Salons de focus',
    detail: 'participation à des sessions de focus partagées avec des amis.',
  },
  {
    label: 'Encouragements',
    detail: 'emojis d’encouragement envoyés ou reçus entre amis.',
  },
  {
    label: 'Piliers et XP',
    detail:
      'les catégories personnelles (« piliers ») que tu définis pour répartir ton temps de focus, et l’expérience (XP) associée.',
  },
  {
    label: 'Journaux d’administration',
    detail:
      'si une action de modération ou d’administration te concerne (par exemple la consultation de tes statistiques par un administrateur), elle est journalisée — voir « Consultation par l’administrateur ».',
  },
  {
    label: 'Dernière activité',
    detail:
      'un horodatage technique de ta dernière activité, pour la sécurité et les statistiques globales et anonymisées d’usage.',
  },
]

export const SUBPROCESSORS: { name: string; role: string }[] = [
  {
    name: 'Supabase',
    role: 'base de données, authentification et stockage des fichiers (photos de profil).',
  },
  { name: 'Vercel', role: 'hébergement de l’application.' },
  {
    name: 'Brevo',
    role: 'envoi des e-mails transactionnels (confirmation d’inscription, réinitialisation de mot de passe).',
  },
  { name: 'Google', role: 'connexion via ton compte Google, si tu choisis ce mode de connexion.' },
]

export const PRIVACY_TEXT = {
  qui: `Cette politique explique comment ${APP_NAME} traite tes données personnelles. Elle s'applique à toute personne qui crée un compte ou utilise l'application. Pour l'identité de l'éditeur, voir les mentions légales.`,
  jamais: `Nous ne vendons jamais tes données. Nous n'affichons aucune publicité dans l'application et ne partageons tes données avec aucun tiers à des fins publicitaires. Nous ne collectons aucune donnée sur les personnes qui ne créent pas de compte : il n'y a aucun outil de mesure d'audience ou de traceur tiers dans l'application (nous avons vérifié le code source pour écrire cette phrase — aucun script de ce type n'y figure).`,
  donneesIntro: `Voici les catégories de données que nous traitons, telles qu'elles existent réellement dans l'application à la date de mise à jour de cette politique :`,
  finalitesIntro: `Nous traitons ces données pour les finalités suivantes, chacune avec sa base légale au sens du RGPD :`,
  finalites: [
    {
      title: 'Fournir le service',
      detail:
        'enregistrer tes sessions, tes tâches, tes notes et tes réglages, et te permettre de les retrouver sur tous tes appareils. Base légale : exécution du contrat qui nous lie (les présentes conditions d’utilisation).',
    },
    {
      title: 'Fonctionnalités sociales',
      detail:
        'gérer tes amis, salons de focus et encouragements, si tu choisis de les utiliser. Base légale : exécution du contrat.',
    },
    {
      title: 'Sécurité et lutte contre les abus',
      detail:
        'détecter les usages anormaux, modérer les contenus signalés, journaliser les actions d’administration. Base légale : intérêt légitime à maintenir un service sûr.',
    },
    {
      title: 'Newsletter sur les nouveautés',
      detail:
        'si tu l’as explicitement demandé (case à l’inscription, ou réglage dans Compte). Base légale : ton consentement, que tu peux retirer à tout moment.',
    },
  ],
  sousTraitantsIntro: `Nous faisons appel aux sous-traitants suivants pour faire fonctionner le service. Chacun n'a accès qu'aux données nécessaires à sa fonction :`,
  conservation: `Tes données sont conservées tant que ton compte existe. Si tu supprimes ton compte (Réglages > Compte), tes données personnelles et le contenu associé sont supprimés. Les messages envoyés au support et les journaux d'administration peuvent être conservés plus longtemps, dans la limite de ce qui est nécessaire pour répondre à une obligation légale ou résoudre un litige en cours.`,
  cookiesIntro: `L'application utilise le stockage local de ton navigateur (localStorage, IndexedDB) uniquement pour des besoins techniques strictement nécessaires au fonctionnement du service : garder ta session connectée, retenir tes réglages et tes données en mode invité, faire fonctionner le minuteur hors connexion. Aucun cookie ni traceur publicitaire ou de mesure d'audience tiers n'est utilisé — ce stockage technique ne nécessite donc pas de bandeau de consentement (article 82 de la loi Informatique et Libertés, exemption des traceurs strictement nécessaires au service demandé).`,
  transferts: `Nos sous-traitants peuvent traiter des données en dehors de l'Union européenne (notamment Supabase, Vercel et Google, des sociétés basées aux États-Unis). Ces transferts s'appuient sur les garanties prévues par le RGPD mises en place par ces sous-traitants (clauses contractuelles types de la Commission européenne, ou mécanisme équivalent).`,
  droitsIntro: `Conformément au RGPD, tu disposes des droits suivants sur tes données : accès, rectification, effacement, portabilité, opposition et limitation du traitement. Tu peux exercer la plupart de ces droits directement dans l'application :`,
  droits: [
    'Accès et rectification : modifie ton pseudo, ton nom affiché et ta photo depuis Réglages > Compte.',
    'Effacement : supprime ton compte depuis Réglages > Compte (action immédiate et irréversible).',
    'Portabilité : exporte une sauvegarde locale de tes données depuis Réglages > Compte.',
    'Opposition au traitement marketing : décoche la case correspondante dans Réglages > Compte à tout moment.',
  ],
  droitsAutres: `Pour toute autre demande (limitation du traitement, question sur tes données), écris-nous à sullivanhuriez@gmail.com. Tu as aussi le droit d'introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL), cnil.fr.`,
  administration: `Un administrateur de l'application peut, dans le cadre strict de ses fonctions (support, modération, statistiques d'usage agrégées), consulter certaines de tes données : tes statistiques de focus et ton activité, jamais le contenu de tes notes ou de tes tâches. Chaque consultation du profil détaillé d'un utilisateur par un administrateur est journalisée (qui, quand) dans un journal d'administration auquel tu n'as pas directement accès, mais que tu peux nous demander de t'exposer (voir Tes droits).`,
  securite: `Nous nous appuyons sur les mécanismes de sécurité de nos sous-traitants (chiffrement en transit, isolation des données par compte via des règles d'accès au niveau de chaque ligne de données) et limitons les accès administratifs au strict nécessaire. Aucune mesure de sécurité n'est infaillible ; en cas de violation de données présentant un risque pour tes droits, nous t'en informerons conformément au RGPD.`,
  modifications: `Nous pouvons mettre à jour cette politique, par exemple si nous changeons de sous-traitant ou ajoutons une fonctionnalité qui traite de nouvelles données. La date de dernière mise à jour en haut de cette page change alors. En cas de changement important, nous te le signalerons de façon visible dans l'application.`,
  contact: `Pour toute question sur cette politique ou sur tes données, écris-nous à sullivanhuriez@gmail.com.`,
} as const
