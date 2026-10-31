import { APP_NAME } from '@/shared/app-config'
import type { LegalSection } from '../components/LegalLayout'

export const TERMS_LAST_UPDATED = '26 octobre 2026'

export const TERMS_SECTIONS: LegalSection[] = [
  { id: 'objet', title: 'Objet et acceptation' },
  { id: 'admissibilite', title: 'Admissibilité et âge minimum' },
  { id: 'compte', title: 'Création et gestion de compte' },
  { id: 'usage', title: 'Usage autorisé' },
  { id: 'interdictions', title: 'Ce que tu ne dois pas faire' },
  { id: 'contenu', title: 'Normes de contenu' },
  { id: 'moderation', title: 'Modération et droit de retrait' },
  { id: 'notifications', title: 'Notifications par e-mail' },
  { id: 'propriete', title: 'Propriété intellectuelle' },
  { id: 'evolutions', title: 'Évolutions du service' },
  { id: 'garantie', title: 'Absence de garantie' },
  { id: 'securite', title: 'Sécurité des données' },
  { id: 'resiliation', title: 'Résiliation' },
  { id: 'droit', title: 'Droit applicable et litiges' },
  { id: 'contact', title: 'Contact' },
]

export const TERMS_TEXT = {
  objet: `Les présentes conditions d'utilisation régissent l'accès et l'usage de ${APP_NAME} (ci-après « l'application » ou « le service »), une application de suivi de concentration (minuteur Pomodoro, compte à rebours, chronomètre, suivi des tâches et des sessions de focus). En créant un compte ou en utilisant l'application, tu acceptes ces conditions dans leur intégralité. Si tu les refuses, n'utilise pas le service.`,
  admissibilite: `${APP_NAME} est accessible à partir de 15 ans, l'âge à partir duquel le droit français (article 45 de la loi Informatique et Libertés) permet à un mineur de consentir seul au traitement de ses données personnelles dans le cadre d'un service en ligne. En dessous de cet âge, l'inscription doit être faite avec l'autorisation d'un titulaire de l'autorité parentale. En créant un compte, tu déclares avoir l'âge requis.`,
  compte: `La création d'un compte demande un pseudo, une adresse e-mail et un mot de passe (ou une connexion via Google). Tu es responsable de l'exactitude des informations fournies et de la confidentialité de ton mot de passe : ne le partage avec personne. Tu es responsable de toute activité qui se produit depuis ton compte. Si tu soupçonnes un accès non autorisé, change ton mot de passe immédiatement et contacte-nous (voir Contact).`,
  usage: `Le service est destiné à un usage personnel, responsable et conforme à la loi. Tu peux l'utiliser pour suivre tes sessions de concentration, gérer tes tâches, et si tu le souhaites, te connecter avec des amis (demandes d'amitié, salons de focus partagés, encouragements). ${APP_NAME} est entièrement gratuit : aucune fonctionnalité n'est payante, il n'y a ni abonnement ni période d'essai.`,
  interdictions: [
    `Extraire ou aspirer automatiquement des données de l'application (scraping, moissonnage) en dehors d'un usage personnel normal ;`,
    `Décompiler, désassembler ou tenter de faire de l'ingénierie inverse sur l'application, sauf dans les cas où la loi l'autorise expressément malgré cette interdiction ;`,
    `Accéder ou tenter d'accéder à des comptes, données ou systèmes qui ne sont pas les tiens, sans autorisation ;`,
    `Mener des attaques par déni de service ou toute action visant à perturber la disponibilité du service pour les autres utilisateurs ;`,
    `Redistribuer, revendre ou republier tout ou partie du contenu ou du code de l'application sans autorisation écrite préalable ;`,
    `Utiliser le service à des fins commerciales sans notre accord explicite ;`,
    `Partager ton compte avec un tiers ou utiliser le compte d'un tiers sans son consentement.`,
  ],
  contenu: `Ce que tu publies ou configures dans l'application (pseudo, nom affiché, photo de profil) doit respecter les règles suivantes : pas de contenu illicite, menaçant, harcelant, haineux, sexuellement explicite ou violent ; pas de contenu lié à des activités illégales ; pas de contenu qui porte atteinte aux droits d'autrui (propriété intellectuelle, image) ou qui expose des données privées d'une autre personne sans son accord. Les messages que tu nous envoies via le formulaire de support sont lus par notre équipe et doivent respecter les mêmes règles.`,
  moderation: `Nous nous réservons le droit de retirer un contenu qui enfreint ces règles, ainsi que de suspendre ou de supprimer un compte en cas de manquement grave ou répété aux présentes conditions, à notre seule appréciation mais de façon proportionnée au manquement constaté. Quand c'est possible, nous t'en informons. Tu peux contester une décision de modération en nous écrivant (voir Contact).`,
  notifications: `Nous pouvons t'envoyer des e-mails liés au fonctionnement du service : confirmation d'inscription, réinitialisation de mot de passe, informations de sécurité liées à ton compte. Ces messages de service sont indispensables au fonctionnement du compte et ne peuvent pas faire l'objet d'une désinscription. Si tu as coché la case correspondante à l'inscription (ou activé le réglage dans Compte), nous pouvons aussi t'envoyer occasionnellement des e-mails sur les nouveautés de l'application : tu peux te désinscrire de ceux-ci à tout moment, sans que cela n'affecte les e-mails de service.`,
  propriete: `L'application, son code, son design et sa marque sont notre propriété ou celle de nos concédants de licence, et sont protégés par le droit de la propriété intellectuelle. Les contenus que tu crées (tâches, notes, pseudo, photo de profil que tu téléverses) restent ta propriété ; tu nous accordes seulement le droit technique nécessaire de les stocker et de les afficher pour te fournir le service (et, pour ton pseudo et ta photo de profil, de les montrer aux autres utilisateurs si tu utilises les fonctionnalités sociales).`,
  evolutions: `Le service peut évoluer : nous pouvons ajouter, modifier ou retirer des fonctionnalités. Nous nous efforçons de t'informer raisonnablement à l'avance des changements significatifs (journal des changements, dans Réglages > Nouveautés), mais nous ne pouvons pas garantir un préavis dans tous les cas, notamment pour des raisons de sécurité ou de disponibilité technique.`,
  garantie: `Le service est fourni « en l'état » et « selon disponibilité ». Nous faisons de notre mieux pour qu'il soit fiable, mais nous ne pouvons pas garantir une disponibilité ininterrompue ni l'absence totale d'erreurs — y compris sur l'exactitude au dixième de seconde près du minuteur, qui dépend de l'horloge et des performances de ton appareil et de ton navigateur. Nous ne saurions être tenus responsables des conséquences indirectes d'une indisponibilité ponctuelle du service (par exemple une session de focus interrompue). Cette limitation ne remet pas en cause les droits impératifs dont tu bénéficies en tant que consommateur en France, en particulier les règles protectrices contre les clauses abusives : rien dans ces conditions ne vise à t'empêcher de faire valoir un droit que la loi te garantit.`,
  securite: `Nous mettons en œuvre des mesures de sécurité raisonnables pour protéger tes données (voir notre politique de confidentialité pour le détail). En cas de violation de données susceptible d'engendrer un risque pour tes droits et libertés, nous t'en informerons dans les meilleurs délais, conformément au RGPD.`,
  resiliation: `Tu peux supprimer ton compte à tout moment depuis Réglages > Compte : cette action est irréversible et supprime tes données associées (voir la politique de confidentialité pour le détail de ce qui est supprimé). Nous pouvons résilier ou suspendre ton accès en cas de manquement grave à ces conditions, selon les modalités décrites à la section Modération.`,
  droit: `Les présentes conditions sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux français seront compétents, sous réserve des règles de compétence impératives applicables aux consommateurs.`,
  contact: `Pour toute question sur ces conditions, écris-nous à sullivanhuriez@gmail.com.`,
} as const
