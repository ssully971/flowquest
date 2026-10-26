# Flowquest : cahier des charges

> Document de référence pour la construction du projet (à placer à la racine du dépôt, par exemple `docs/CAHIER_DES_CHARGES.md`). Il sert de source de vérité pour Claude Code.

## 1. Vision

Flowquest (« la quête du flow ») est un tableau de bord de concentration, 100 % gratuit, inspiré de **Flocus** (ambiance, horloge, thèmes, réglages) et de **Forest** (amis, classement, sessions de groupe, défis, succès). Il fonctionne dans le navigateur, sur ordinateur et sur iPad, et s'installe comme une application (PWA).

Public initial : étudiants (tutorat, amis de promo). Aucun paiement, aucune fonctionnalité verrouillée : tout ce qui est « Plus » chez Flocus est gratuit ici.

**Hors périmètre (volontairement)** : intégration Spotify, mode « animedoro », mode 52/17 (couvert par le pomodoro personnalisable), vidéos en fond d'écran.

## 2. Principes et contraintes

- **Gratuit à vie** : hébergement statique + offres gratuites uniquement.
- **Un sujet à la fois** : la V1 doit être utilisable seule, sans compte.
- **Le minuteur ne ment jamais** : il se calcule à partir d'horodatages, jamais en comptant des ticks (voir §5).
- **Contenu pilotable sans toucher au code** : thèmes, citations, sons, défis, succès, nouveautés vivent en base et se gèrent depuis le panneau Admin.
- **Extensible** : la future collection d'objets (§13) doit pouvoir se greffer sans refonte.
- **Langue** : français uniquement au départ, mais tous les textes passent par un fichier de traduction (i18n) pour ajouter l'anglais plus tard.

## 3. Stack technique (proposée)

| Couche | Choix | Raison |
|---|---|---|
| Front | React + Vite + TypeScript | Même base qu'Outremed |
| Styles | Tailwind CSS | Rapide, thèmes via variables CSS |
| Back | Supabase (Postgres, Auth, Realtime, Edge Functions, Storage) | Offre gratuite, tout-en-un |
| Hébergement | Vercel (ou Cloudflare Pages) | Gratuit, déploiement via GitHub |
| PWA | `vite-plugin-pwa` + service worker | Installation, hors-ligne, push |
| Données locales | IndexedDB / localStorage | Mode invité et reprise du minuteur |

**Limites gratuites à surveiller** : Supabase met un projet inactif en pause après 7 jours (un petit ping planifié peut l'éviter) ; stockage 1 Go ; Realtime limité en connexions simultanées. Les fonds sont des images/dégradés/CSS légers, les sons des boucles compressées servies avec le site.

## 4. Comptes, rôles et modes d'accès

- **Invité** : utilise le minuteur, les tâches, les notes et les réglages avec stockage sur l'appareil. Pas d'amis, de classement ni de salles.
- **Utilisateur** : compte par e-mail + mot de passe (8 caractères min., 1 majuscule, 1 chiffre) ou **Google**. Données synchronisées entre appareils. Pseudo unique obligatoire à l'inscription (pour les amis).
- **Admin** : même type de compte avec `role = 'admin'`. Le panneau Admin n'apparaît que pour ce rôle. **La sécurité est appliquée côté base (RLS), pas seulement dans l'interface.** Sullivan utilise deux comptes distincts (admin et perso) avec deux adresses e-mail.
- **Apple Sign-In** : exclu (99 $/an). À reconsidérer plus tard.
- **Migration invité → compte** : à la création du compte, les données locales sont proposées à l'import.
- Suppression de compte et export des données : disponibles dans Compte (RGPD).

## 5. Écrans et modes

Trois modes, basculables en bas à droite. Le dernier mode utilisé est mémorisé.

### 5.1 Mode Home (accueil)
- Haut gauche : **logo/nom « Flowquest »**.
- Haut droite : **citation** qui change (à chaque chargement ou chaque jour, au choix de l'utilisateur).
- Centre : **phrase de salutation** avec le prénom, puis **l'heure** en grand.
- Salutations dynamiques : varient selon l'heure et le jour de la semaine (« La semaine commence, Sullivan »). Désactivées : « Bonjour » fixe. Option pour masquer complètement la salutation.

### 5.2 Mode Focus
- Même fond que Home (thème propre au mode Focus), centré : question « Sur quoi te concentres-tu ? » (tâche active), onglets **Focus / Pause courte / Pause longue**, points de progression des sessions, minuteur, boutons lecture/pause, passer, réinitialiser, **Picture-in-Picture**.

### 5.3 Mode Ambiant
- Fond d'écran plein cadre, minuteur compact dans une carte **en haut à droite**, le reste de l'écran libre.

### 5.4 Éléments communs
- **Bas gauche** : tâches, notes (pas de Spotify). Les panneaux s'ouvrent au-dessus du bouton.
- **Bas droite** : compteur de série (flamme + nombre), sélecteur de mode, **réglages**, **plein écran**.
- Position finale des boutons (réglages notamment) à valider sur les maquettes.
- **Panneau de réglages et page Compte : ils s'ouvrent depuis la gauche** (pas depuis la droite comme Flocus).
- Mode « écran épuré » : masque l'interface quand la souris n'est pas sur la fenêtre (ne marche pas sur tablette, comme chez Flocus).
- « Empêcher la mise en veille » via l'API Screen Wake Lock (selon support Safari).

## 6. Minuteur

### 6.1 Modes
- **Pomodoro** : focus **10 à 100 min**, pause courte **1 à 20 min**, pause longue **20 à 40 min**, nombre de sessions avant la pause longue réglable (4 par défaut). Défauts : 25 / 5 / 10 (à confirmer).
- **Compte à rebours** : durée libre.
- **Chronomètre** : compte vers le haut, sans fin.
- **Task ETA** (V2, optionnel) : chaque tâche a une durée estimée, le minuteur enchaîne les tâches et affiche « terminé à 20h37 ». Hors V1.

### 6.2 Fonctionnement en arrière-plan (exigence majeure)
Le minuteur survit à : changement d'onglet, quitter Safari, rafraîchir la page, verrouiller l'iPad, fermer puis rouvrir l'app.

Principe : à chaque lancement, on enregistre `{état, started_at, durée, segment, pauses cumulées}`.
- L'affichage se **recalcule à partir de l'heure courante** à chaque rendu ; le temps restant n'est jamais stocké sous forme de compteur.
- L'état est écrit en local (IndexedDB) **et**, si connecté, en base, pour qu'un rechargement ou un autre appareil reprenne la session.
- Au retour, si la fin est dépassée : la session est **validée avec sa vraie heure de fin** et la transition suivante est appliquée (pause, etc.).
- **Notification de fin** : un navigateur ne peut pas jouer de son page fermée. On utilise le **Web Push** : à chaque lancement, l'app enregistre une notification programmée ; une Edge Function Supabase planifiée (pg_cron, toutes les minutes) envoie les push arrivés à échéance. Annulée si la session est mise en pause ou abandonnée.
- **Installation PWA obligatoire pour le push sur iOS** (iOS 16.4+) : une **popup discrète** explique « Ajoute Flowquest à l'écran d'accueil pour recevoir l'alerte de fin », visible sur iOS et Android, une seule fois, avec « Plus tard ». Le son d'alerte ne joue que si l'app est ouverte ; en arrière-plan c'est la notification système qui prévient.

### 6.3 Picture-in-Picture
Via Document Picture-in-Picture (Chrome/Edge ordinateur) ou, à défaut, une fenêtre vidéo/canvas en PiP classique, elle-même déclenchée via `requestPictureInPicture()` standard ou, en repli, l'API historique `webkitSetPresentationMode()` de WebKit. Option « Afficher la tâche dans le PiP ».

**Limite connue sur Safari iPad** : `webkitSetPresentationMode` y est bien présent, mais la source vidéo vient ici d'un `<canvas>` (`canvas.captureStream()`), pas d'un média réel — WebKit refuse ou ignore silencieusement le passage en PiP pour ce type de source sur iPad dans plusieurs versions connues, alors que cela fonctionne sur Safari macOS. Aucun contournement fiable n'existe à ce jour. Comportement donc non garanti sur iPad, à tester sans bloquer la V1 : le bouton reste proposé en meilleur effort, mais l'état « actif » n'est affiché que si le navigateur confirme réellement l'entrée en PiP (jamais de faux positif).

### 6.4 Réglages du minuteur
- Style d'affichage : **défaut, flip clock, barre de progression, jauge, matrice de points, camembert**.
- Afficher la barre de progression sous le minuteur.
- Notification navigateur à la fin du segment (activable).
- **Démarrage auto du segment suivant** (en compte à rebours : relance auto).
- Afficher le compteur de série dans le tableau de bord.
- Alerte de fin : choix du son + volume (+ « Aucune alerte »). Sons fournis par Sullivan, libres de droits.
- **Compteurs de sessions** : points, cœurs, étoiles, tomates, éclairs, diplôme, flocons, bonhomme de neige… tous gratuits. Liste extensible depuis l'admin.

### 6.5 Raccourcis clavier ✅ (LOT G1)
Un seul écouteur `keydown` (hook `useKeyboardShortcuts`), monté dans Focus et Ambiant
(jamais une nouvelle instance du moteur) :
- **Espace** : lancer / mettre en pause / reprendre (`preventDefault` ciblé — ni
  défilement de page, ni double activation d'un bouton qui a le focus).
- **N ou →** : passer à la phase suivante.
- **R** : réinitialiser la phase en cours.
- **M** : couper/rétablir les sons d'ambiance (gain maître Web Audio — n'a d'effet que
  sur l'écran Ambiant, seul endroit où des sons jouent).
- **?** : ouvre une petite fenêtre d'aide listant les raccourcis.

Inactifs dans un champ de saisie (input/textarea/select/contenteditable), pendant qu'une
fenêtre modale est ouverte (détecté génériquement via `role="dialog"`), avec un
modificateur (Ctrl/Cmd/Alt), ou en auto-répétition (`event.repeat`). Réglage « Raccourcis
clavier » dans Réglages > Minuteur (activé par défaut, synchronisé par compte) — aucun
bouton permanent ajouté à l'écran : l'aide s'ouvre par « ? » ou par un lien dans ce même
réglage.

### 6.6 Deep Focus ✅ (LOT G2)
Réglage « Deep Focus » dans Réglages > Minuteur (**désactivé par défaut**, synchronisé
par compte) : met en pause une session de focus (Pomodoro, phase focus uniquement —
jamais une pause, jamais le chronomètre libre, jamais un salon de groupe) si l'onglet
passe en arrière-plan plus longtemps qu'un délai de grâce réglable (5 s par défaut, 0 à
60 s).

- Détection via `visibilitychange` (`document.visibilityState === 'hidden'`). La pause
  est **rétroactive à l'instant précis où l'onglet a été quitté** (horodatage capturé à
  ce moment, pas à l'instant du retour) — le moteur à timestamps du minuteur l'utilise
  tel quel pour geler le temps écoulé.
- Double chemin de résolution pour rester juste même quand iOS gèle l'exécution JS en
  arrière-plan (le `setTimeout` normal peut ne jamais s'exécuter) : un recalcul a lieu
  aussi au retour (`visible`), à partir de l'horodatage réel du départ.
- Au retour, un **toast discret** (jamais de boîte de dialogue navigateur) : « Ton
  minuteur a été mis en pause. Reprends quand tu veux. » avec un bouton Reprendre.
- Pendant qu'elle est active, un **petit indicateur discret** (icône de cadenas) apparaît
  près du minuteur — seul signe visible du mode, aucun bouton permanent ajouté à l'écran.

## 7. Réglages (panneau gauche)

Menu : Thèmes · Horloge · Minuteur · Stats · Citations · Extras · Compte · Support · Nouveautés.

### 7.1 Thèmes
- Un thème **par mode** (Home, Focus, Ambiant).
- Bibliothèque par catégories : Dégradés et couleurs, Abstrait, Scénique, Nature, Urbain, Intérieur, Animé (animations **CSS/canvas légères**, pas de vidéo).
- Fond personnalisé (image envoyée par l'utilisateur, stockée sur l'appareil ou dans son espace Storage avec limite de taille).
- Quelques thèmes prédéfinis au lancement ; les suivants sont ajoutés par l'admin.

### 7.2 Horloge
- Format **12 h / 24 h** ; taille **petite / normale / énorme** (s'applique à l'horloge et au minuteur) ; afficher les secondes ; horloge « flip » ; salutations (dynamiques / activées).
- **Styles de police** : Default Bold, Default Light, Soft, Bubble, Minimal Light, Minimal, Serif, Serif Condensed, Sporty, Heavy Wide, Digital, Handwritten (polices libres de droits, auto-hébergées).

### 7.3 Minuteur : voir §6.4.

### 7.4 Stats : voir §9.

### 7.5 Citations
- Catégorie au choix ; afficher en mode Focus ; afficher en Home. Les citations sont gérées par l'admin.
- **Rythme sur Focus ✅ (LOT G1)** : citation aléatoire au chargement, puis une nouvelle à
  chaque début de phase (démarrage réel d'une session ou d'une pause — pas en changeant
  simplement d'onglet de segment sans démarrer, ni en mettant en pause/reprenant), jamais
  deux fois de suite la même. Fondu d'opacité ~300 ms (coupé si `prefers-reduced-motion`).
  Indépendant du réglage « rotation » (quotidienne / à chaque chargement) ci-dessus, qui
  reste la référence pour l'Accueil — sur Focus, le rythme naturel est celui des phases.

### 7.6 Extras
- Nom affiché sur le tableau de bord ; désactiver les thèmes animés (appareils lents) ; mode épuré ; empêcher la veille ; onglet des réglages ouvert par défaut ; **randomiseur de thème** à chaque chargement ; **confirmer avant de supprimer une tâche** (activé par défaut — LOT H1, voir §10.6).

### 7.7 Compte
- Création de compte / connexion (e-mail + Google), pseudo, prénom, e-mail, mot de passe, suppression du compte, export des données, déconnexion.

### 7.8 Support
- Formulaire « Contacter le support » : le message est enregistré en base. L'admin le lit et le marque **traité** ; **la réponse part par e-mail** (hors application). Liens : centre d'aide / FAQ, retour d'expérience, version de l'app.

### 7.9 Nouveautés
- Journal des versions rédigé dans le panneau Admin ; badge « nouveau » tant que la dernière entrée n'est pas lue.

## 8. Tâches et notes

- **Tâches** : liste réordonnable par glisser-déposer, case à cocher, **sous-tâches, emojis, couleurs, durée estimée (ETA), confettis à la dernière tâche cochée**. Tous gratuits. Une tâche peut être liée au minuteur (affichée en Focus).
- **Bloc-notes** : éditeur riche (gras, italique, titres, listes, cases), compteur de mots et de caractères, enregistrement automatique.
- Synchronisation si connecté, sinon local.

## 9. Statistiques

- Périodes : **aujourd'hui, semaine, mois, 3 mois, 6 mois, année, depuis le début**.
- Cartes : **série actuelle** (et plus longue série dessous), **temps de focus**, **nombre de sessions**, **temps de pause**, **tâches terminées**, **score de focus**.
- **Score de focus** (définition proposée) : part des segments de focus lancés qui sont allés jusqu'au bout, pondérée par la régularité sur la période. À préciser avant l'implémentation.
- **Calendrier de focus** façon GitHub, en heures ou en sessions, vue 6 mois ou 1 an.
- **Tendance de focus** : courbe sur la période choisie.
- Chaque variation est comparée à la période précédente (flèche + pourcentage).

### 9.1 Piliers de Vie ✅ (LOT G3)
Chaque session de focus peut se rattacher à un pilier (Travail, Sport, Études…) pour
suivre l'équilibre entre les domaines de vie.

- **Données** : table `pillars` (nom, couleur, XP, niveau, archivage), colonne
  `pillar_id` nullable sur `focus_sessions`. Maximum **8 piliers actifs** par
  utilisateur (archiver un pilier libère une place). Un pilier « Général » est créé à la
  toute première utilisation.
- **XP** : dérivée du **temps RÉEL de focus enregistré** (`actual_seconds`), jamais de la
  durée prévue — cohérent avec le §6.2 (un Pomodoro arrêté à 18 min donne l'XP de
  18 min). **1 min = 10 XP.** Toujours recomposée côté serveur (fonction SQL
  `recompute_pillar_xp`, déclenchée par un trigger sur `focus_sessions`) à partir de la
  somme des sessions enregistrées — jamais à partir d'un compteur local, et donc
  idempotente si une session est envoyée deux fois et juste entre appareils.
- **Courbe de niveau** : passer du niveau *L* à *L+1* coûte *600·(L+1)* XP (croissant).
  Le niveau 2 s'atteint à 600 XP, le niveau 3 à 1800 XP, etc.
- **Interface, sans encombrer** : une pastille colorée discrète à côté du titre de la
  session sur l'écran Focus (aucun nouveau bouton permanent), qui ouvre un petit menu —
  le dernier pilier utilisé reste présélectionné. Création, renommage, couleur,
  archivage dans **Réglages > Piliers**. Une animation brève de niveau gagné dans le
  bilan de session (si le bilan est activé), jamais une popup séparée.
- **Statistiques** : carte « Équilibre » avec un graphique radar (au moins 3 piliers
  actifs ; message clair sinon) et la liste des piliers avec niveau et barre d'XP.

### 9.2 Galaxie de nœuds ✅ (LOT G4)
Un onglet « Galaxie » dans Stats (bascule interne Aperçu/Galaxie, jamais un fond
permanent sur l'accueil, le Focus ou l'Ambiant) : chaque session de focus validée devient
une étoile.

- **Rendu** : canvas 2D, une passe dessinée dans un canvas hors écran puis mise en cache
  — jamais de boucle d'animation pour l'affichage normal, redessiné seulement si les
  données ou la taille changent. `devicePixelRatio` géré. Un scintillement très léger
  (une poignée d'étoiles, intervalle espacé — jamais 60 fps) est coupé par
  `prefers-reduced-motion` et dès que l'onglet passe en arrière-plan.
- **Étoiles** : taille proportionnelle à la durée réelle (bornée), couleur du pilier
  (gris doux si aucun). Les sessions d'un même jour calendaire sont reliées par de fines
  lignes translucides, dans leur ordre chronologique.
- **Positions déterministes** : hachage de l'id de la session (jamais `Math.random()`) —
  la même session retombe toujours exactement au même endroit.
- **Plafond** : 1 500 étoiles individuelles au maximum (les plus récentes) ; au-delà, les
  sessions plus anciennes sont regroupées par mois et par pilier en une étoile agrégée.
- **Interaction** : survol (ordinateur) ou toucher (tactile) affiche une info-bulle
  (date, durée, pilier). Filtres par période (30 jours, 90 jours, tout) et par pilier,
  intégrés à la vue elle-même.
- **Chargement** : sessions lues par curseur IndexedDB (jamais un `getAll()` en bloc),
  seulement quand la vue est ouverte — jamais au démarrage de l'app.
- Option envisagée pour plus tard : utiliser la galaxie comme fond de l'écran Ambiant —
  proposée, pas construite dans ce lot.

## 10. Social (V2 — « Mode Amis », livré en 4 lots F1 à F4, voir `docs/AMIS.md`)

### 10.1 Amis ✅ (LOT F1)
- Ajout par **pseudo exact + demande à accepter**, ou par **code ami** (8 caractères,
  régénérable), avec aperçu avant envoi. Quota de 20 demandes/jour.
- Liste d'amis, demandes reçues/envoyées (acceptation, refus, retrait), blocage (un compte
  bloqué ne peut plus recontacter, message générique sans révéler le blocage).
- Signalement d'un compte (réutilise les messages du support, catégorie dédiée).
- Photo de profil : recadrage carré, réduction 256×256 WebP ≤ 40 Ko, avatar par défaut
  généré (jamais de case vide).
- Page « Amis » (onglet principal) et réglages de vie privée dédiés (« Amis et
  confidentialité ») : mode invisible, statut en direct, temps/score visibles, participation
  au classement — tous appliqués côté base, pas seulement côté interface.

### 10.1 bis Statut en direct et encouragements ✅ (LOT F2)
- Statut en direct (focus/pause/inactif, jamais le détail de ce qui est étudié), visible
  des amis qui l'autorisent, avec battement de cœur et détection « hors ligne » après 2
  minutes sans mise à jour.
- Encouragements : cinq emojis fixes, quotas, affichés en bandeau groupé hors des sessions
  de focus (jamais pendant, toujours à la fin ou à l'ouverture de l'app).

### 10.2 Classement ✅ (LOT F2)
- Classement **hebdomadaire** (semaine en cours ou précédente — pas « semaine/mois/depuis
  le début » comme envisagé plus haut : simplifié à la semaine seule pour ce lot, visible
  entre amis uniquement, et toujours soi-même en plus des amis participants).
- Un utilisateur peut désactiver sa participation (`participate_leaderboard`) : il
  disparaît alors du classement des autres, sans affecter sa propre vue.
- Score = taux d'achèvement × (0,7 + 0,3 × régularité) — voir `docs/AMIS.md` pour le détail
  et l'écart assumé avec le score personnel de la page Stats.

### 10.3 Salons de focus ensemble ✅ (LOT F3)
Livré sous une forme volontairement plus restreinte que l'esquisse ci-dessus initialement
envisagée — voir `docs/AMIS.md` pour le détail produit complet et les écarts assumés :
- Création d'un salon par **invitation entre amis** uniquement (`are_friends()`), jamais
  par un code court public ni un lien partageable — reste dans le périmètre du Mode Amis,
  pas une salle ouverte à n'importe qui. Au plus 6 personnes (hôte compris).
- Le créateur choisit uniquement la **durée d'une session de focus** (5 à 120 min) : pas
  encore de réglage séparé pour la pause ni de nombre de cycles — **une seule session par
  salon** dans ce lot (pas d'enchaînement automatique de pauses).
- **Contrôle toujours réservé à l'hôte** (démarrer/pause/reprendre/terminer) : pas d'option
  « donner la main à tous » dans ce lot.
- **Règle d'abandon différente de l'esquisse initiale** : un abandon (silence de plus de 2
  minutes pendant que le salon tourne) **ne annule pas la session pour tous** — l'hôte
  absent voit simplement son rôle transféré au participant encore présent le plus ancien,
  et la session continue pour qui reste. Jugé plus utile en pratique qu'une annulation
  collective à chaque déconnexion ponctuelle (Wi-Fi, onglet suspendu).
- Minuteur partagé synchronisé via `started_at`/`duration_ms` stockés côté serveur, recalculé
  côté client (jamais accumulé localement) — même principe que prévu, réalisé via
  Supabase/Postgres plutôt qu'un serveur dédié.
- Liste des présents en temps réel (Supabase Realtime sur `rooms`/`room_participants`,
  repli par interrogation).
- **Pas encore couvert** : aucun partage de tâche entre participants (hors périmètre),
  et les sessions de salon ne comptent pas encore dans les statistiques personnelles ni la
  série individuelle de chacun — décision délibérément différée, voir `docs/AMIS.md`.

### 10.4 Série partagée ✅ (LOT F4)
- Une série par paire d'amis, affichée en flamme 🔥 directement sur la liste d'amis (pas
  d'écran dédié) : un jour compte dès que les deux ont chacun complété au moins une
  session de focus ce jour-là — voir `docs/AMIS.md`/`docs/SECURITE.md` pour la définition
  exacte, volontairement différente de la série individuelle (objectif quotidien).
- Entretenue côté base (trigger sur `focus_sessions`), mise à jour en temps réel entre les
  deux comptes concernés.
- **Pas encore couvert** : pas de rappel avant de perdre la série, et les sessions faites
  dans un salon de focus (§10.3) n'y comptent pas encore (même limitation assumée que pour
  les statistiques personnelles).

### 10.5 Finitions (LOT F4)
Passe de relecture sur l'ensemble du Mode Amis (F1 à F4) avant de le considérer complet :
- Tous les écrans vérifiés pour un état vide/chargement/erreur cohérent (liste d'amis,
  demandes, classement, mes salons, création de salon).
- Deux écarts trouvés et corrigés : `create_room()` acceptait une liste d'invités vide
  (un salon sans personne n'a pas de sens — désormais refusé, côté base et côté
  interface) ; `generate_unique_username()` n'avait pas de droit d'exécution explicite
  (voir « Passe de sécurité » dans `docs/SECURITE.md`).

### 10.6 Corrections et temps réel (LOT H1)
- **Bug corrigé** : `get_room_state()` renvoyait « column reference "room_id" is
  ambiguous » (collision entre les colonnes de sortie de la fonction et les colonnes
  internes de `room_participants` dans son `UPDATE`). Même défaut trouvé et corrigé dans
  `list_duo_streaks()` à l'audit ; `weekly_leaderboard()` durci par précaution (ordre
  positionnel plutôt que par alias). Migration dédiée (`0035_fix_ambiguous_columns.sql`),
  anciennes migrations non modifiées.
- **Temps réel des demandes d'amis, encouragements et invitations de salon**
  (`0036_social_realtime.sql`, publication `supabase_realtime`) : toast discret dès
  qu'une nouvelle entrée apparaît, détectée par différence avec le dernier état connu —
  repli par interrogation 30 s et reconnexion au retour d'onglet déjà fournis par
  l'infrastructure temps réel existante (voir §10.3).
- **État clair quand on n'est pas connecté** sur les écrans sociaux (panneau Amis,
  panneau Salons, Réglages > Amis et confidentialité) : icône, message, bouton
  « Se connecter » qui rouvre l'écran de connexion existant — remplace un écran
  auparavant vide.
- **Durée d'un salon (§10.3)** : le curseur affiche désormais sa valeur en direct, avec
  un champ saisissable au clavier en plus des 4 préréglages rapides (15/25/45/60 min).
- **Suppression d'une tâche (§8)** : confirmation avant suppression, réglage
  « Confirmer avant de supprimer une tâche » dans Extras (activé par défaut) ;
  désactivé, la suppression est immédiate avec un toast « Annuler » (5 s).
- **Harmonisation** : tous les champs numériques de Réglages > Minuteur utilisent le même
  stepper compact (−/valeur/+, largeur alignée sur les autres lignes du panneau).

### 10.7 Épuration et mobile (LOT H2)
- **Point d'entrée social unique** (§10.1, §10.3, §10.2) : les boutons Amis et Salons,
  jusque-là en bas à droite de l'accueil, ont disparu. `SocialPanel` les fusionne (onglets
  Amis/Demandes/Classement/Salons/Ajouter) derrière un seul point d'entrée — la carte
  profil en haut du panneau Réglages (avatar, pseudo, « Amis, salons et classement »).
  L'icône d'engrenage porte une petite pastille quand il y a une demande d'ami, un
  encouragement ou une invitation de salon non lus ; le toast d'invitation de salon a
  maintenant un bouton « Accepter » qui agit directement.
- **Tailles** : deux tailles d'horloge plus petites que « Petite » ajoutées (XS, S —
  Réglages > Horloge). Réglage « Taille des icônes » (Petite par défaut, Moyenne,
  Grande, synchronisé par compte) appliqué au bouton à icône générique utilisé dans toute
  l'interface (barre du bas, contrôles du minuteur) — traits plus fins par défaut.
- **Modes de l'app en icônes** (retour après feu vert) : c'est le sélecteur
  Accueil/Focus/Ambiant de la barre du bas qui porte des icônes (Home/Timer/Moon), pas les
  onglets Focus/Pause courte/Pause longue de l'écran Focus — remis au texte d'origine
  (légèrement réduit, `text-xs`). Le nom du mode n'apparaît sous son icône que pour le
  mode actif. Taille pilotée par le même réglage « Taille des icônes » que les boutons
  génériques, sur tous les types d'appareil (pas seulement mobile).
- **Survol discret** (souris uniquement, `@media (hover: hover)`, Tailwind v4) : curseur
  pointer et infobulle (nom de l'icône, après 400 ms) sur les boutons à icône — jamais
  d'effet resté « collé » sur un appareil tactile.
- **Mobile, écran Accueil et écran Focus** : un seul bouton « Menu » (icône hamburger)
  regroupe Réglages et Plein écran derrière un petit menu ancré, sur les deux écrans —
  trop chargés sinon. Série, sélecteur de mode, Tâches et Notes restent directement dans
  la barre (leur panneau ancré se serait mal positionné hors de leur propre bouton).
  Écran Focus : logo + citation épinglés en haut (comme l'Accueil, plus aérés qu'au milieu
  d'un bloc centré), titre « Sur quoi veux-tu te concentrer ? », horloge, 2 boutons
  (Lancer, Réinitialiser). Tâche active, pilier, sélecteur Pomodoro/Compte à
  rebours/Chronomètre et objectif masqués sur mobile (desktop inchangé, rien de supprimé) ;
  Passer/Terminer/Image dans l'image restent masqués tant que rien n'a démarré, révélés dès
  que la session est en cours.
- **Pas encore couvert** : la barre du bas reste deux groupes de boutons séparés plutôt
  qu'un seul bandeau unifié comme sur les captures de référence — jugé trop risqué à
  refondre entièrement dans ce lot ; Réglages, Tâches, Notes et Statistiques restent des
  panneaux complets (non concernés par la règle « écran de travail », réservée à
  Accueil/Focus/Ambiant).

### 10.8 Fonds d'écran, couleurs et Deep Focus (LOT H3)
- **Nouvelles photos** (11 fichiers triés et convertis) : `public/backgrounds/scenic/`
  (Brouillard, Pirogue, Pourpre, Envol), `public/backgrounds/interior/` (Foyer),
  `public/backgrounds/abstract/` (Nébuleuse, Velours, Éclipse, Spectre, Prisme, Agate —
  dégradés de couleur façon prisme). Chaque fichier : WebP ≤ 1920 px de large, qualité
  ~80, vignette WebP 480 px dans un sous-dossier `thumbs/`. Le bokeh de 10 Mo (sapin de
  Noël, catégorie Intérieur) tombe à moins de 100 Ko une fois converti. Originaux
  supprimés de la racine du dépôt une fois le registre mis à jour
  (`src/shared/design-system/backgrounds/photo-backgrounds.tsx`).
- **Bibliothèque de fonds repensée** (`ThemesPage`, façon Flocus) : puces de catégorie
  en haut (dont une nouvelle catégorie « Minimal ») ; en vue « Tous », une rangée par
  catégorie avec au plus 4 vignettes visibles (défilement horizontal, nom sous chacune,
  contour `--accent` sur la sélection) et un bouton « Tout voir (N) » qui bascule sur la
  grille complète de cette catégorie (même mécanisme que cliquer sa puce). Vignettes
  photo en chargement différé (`loading="lazy"`, déjà en place depuis le lot 3).
- **Un fond par thème** (`useBackgroundSettings`, `background-selection.ts`) : chaque
  mode (Accueil/Focus/Ambiant) a désormais un fond pour le thème sombre et un pour le
  thème clair (`{ dark, light, linked }`), qui change automatiquement avec le thème actif.
  Dans la bibliothèque, un sélecteur « Pour : Sombre / Clair » choisit quel thème on
  modifie, et une case « Utiliser le même fond pour les deux thèmes » (activée par défaut
  pour Ambiant, désactivée pour Accueil/Focus) garde les deux slots alignés quand elle est
  cochée. Défauts : Aurore (sombre) et Lueur (clair) pour Accueil/Focus, Fjord (les deux)
  pour Ambiant. Synchronisé par compte comme le reste des réglages (même mécanisme
  générique `AppSettings`/`user_settings`, pas de nouvelle table) ; un ancien choix
  (format à une seule valeur par mode, avant ce lot) est migré automatiquement vers les
  deux thèmes à la première lecture, jamais perdu.
- **Fonds « Minimal »** : Noir pur (#000, OLED) et Blanc pur (#FFF) ajoutés à la
  bibliothèque, rendus en CSS pur (`SolidBackground.tsx`), pas en photo.
- **Couleur de l'horloge par thème** (`clock-settings.ts`) : la palette proposée dans
  Réglages > Horloge change avec le thème actif — en sombre, des tons doux et désaturés
  (blanc cassé, lavande, rose poudré, vert d'eau, sable) ; en clair, des tons profonds
  (encre, indigo, bordeaux, vert forêt, brun). Chaque couleur vérifiée à au moins 4,5:1 de
  contraste contre la teinte de base du thème (`clock-color-contrast.ts`, seuil relevé de
  3:1 à 4,5:1) ; l'avertissement discret existant (§7.2) s'applique désormais à ce seuil.
- **Mode Deep Focus, mise en page** (`DeepFocusSession.tsx`) : une fois une session de
  focus démarrée avec Deep Focus actif (jamais avant que Lancer soit pressé), l'écran
  Focus devient entièrement un fond noir pur + horloge blanche (thème sombre) ou fond
  blanc pur + horloge noire (thème clair) — rien d'autre (pas de citation, pas de barre du
  bas, pas de fond d'écran), juste le temps, un bouton pause/reprise et un bouton
  terminer. Les deux boutons s'estompent après 3 s d'inactivité et reviennent au moindre
  geste (pointeur ou clavier). Reste affiché pendant une pause (manuelle ou déclenchée par
  le comportement de pause à la sortie de l'onglet, §9), pas pendant l'écran de fin de
  session ni le palier d'objectif atteint. Retour normal dès la fin de la session.

### 10.9 Sons en boucle, Piliers et Galaxie (LOT H4)
- **Boucle d'ambiance sans coupure** (`crossfade-loop.ts`) : chaque son d'ambiance
  (rain/waves/forest/fire) ne boucle plus via `AudioBufferSourceNode.loop = true` (qui
  recolle la fin au début à l'échantillon près, mais n'efface pas un défaut du fichier
  source lui-même) mais via deux lectures en alternance, chevauchement d'1 s (retenu pour
  les quatre fichiers du catalogue, mesurés entre 10,8 s et 30,2 s — voir
  `sounds.ts`), enveloppe de gain à puissance égale (cos/sin, posée par
  `AudioParam.setValueCurveAtTime`). Toute la planification (instants de lecture, courbes)
  est calculée à l'avance en valeurs de `AudioContext.currentTime`, jamais déclenchée par
  un `setTimeout` — la chaîne se poursuit au-delà des deux premières lectures par relais
  via `onended` (évènement du moteur audio), avec plusieurs secondes de marge avant chaque
  calcul suivant, pour rester fiable même si l'onglet passe en arrière-plan.
- **Galaxie dans Piliers** : la galaxie et la carte « Équilibre » (radar) quittent l'onglet
  Statistiques général pour la section Réglages > Piliers (sous le radar) — les deux
  concernent les piliers, pas les statistiques générales de tâches/temps de focus.
- **Disposition en spirale** (`galaxy-layout.ts`) : fini le placement pseudo-aléatoire par
  hachage. Un bras par pilier, régulièrement répartis (angle stable, dérivé du rang du
  pilier dans la liste complète du compte, pas du sous-ensemble filtré à l'écran), bras
  gris pour les sessions sans pilier ou dont le pilier référencé n'existe plus. Chaque
  étoile placée le long de son bras à rayon croissant selon l'ordre chronologique (la plus
  ancienne au centre), avec une distance minimale garantie entre étoiles consécutives et
  un léger décalage borné et déterministe (jamais `Math.random()`) pour un aspect naturel.
  Limite assumée : au-delà d'environ un tour de spirale par bras (~45 sessions sur un même
  pilier), deux étoiles de tours différents peuvent se rapprocher visuellement — contre
  aucune garantie du tout avant ce lot.
- **Objectifs de niveau par pilier** (`pillar-xp.ts`, colonnes `goal_level`/`goal_deadline`
  sur `public.pillars`, migration `0037_pillar_goals.sql`) : niveau visé, date limite
  optionnelle. Progression affichée (XP restante, barre) et, si une date limite est fixée,
  le temps de focus moyen par jour nécessaire pour l'atteindre à temps. Notification
  discrète et distincte d'un simple niveau gagné dans le bilan de session, à l'instant
  précis où l'objectif est franchi. RLS propriétaire et GRANT déjà en place depuis la
  migration 0034 (table entière), revalidés explicitement dans la nouvelle migration.
- **Désactiver les piliers** (réglage « Activer les piliers de vie », Réglages > Extras,
  synchronisé par compte comme le reste) : désactivé, plus de sélecteur de pilier sur
  l'écran Focus, plus d'entrée de navigation Piliers dans Réglages (donc plus de radar, de
  galaxie ni de calcul d'XP affiché — redirige vers Thèmes si on y était resté), et les
  sessions enregistrées n'attachent plus de pilier même si un pilier était resté actif.
  Les données des piliers ne sont jamais supprimées : tout réapparaît tel quel si le
  réglage est réactivé.

### 10.10 Fonds d'écran, boutons en verre et pages légales (LOT I1)
- **8 nouveaux fonds photo** ajoutés à la bibliothèque (Pixabay — `aalmeidah`, `decster1`,
  `ievali`, `jozefm84`, `nnnhi` — voir `docs/CREDITS.md`) : Lac bleu, Chalet enneigé, Cerf
  des neiges, Crête mauve, Veillée au lac, Pleine lune (catégorie Paysages), Forêt
  d'aquarelle (Nature), Ardoise (Urbain, nouvelle catégorie photo). Convertis en WebP
  (≤ 1920 px, < 400 Ko) avec vignette 480 px. Deux images laissées de côté par prudence
  sur les droits (une réinterprétation retravaillée de *La Grande Vague de Kanagawa*, une
  scène très proche de l'illustration promotionnelle du jeu *Firewatch*) — détail et
  raisons dans `docs/CREDITS.md`.
- **Boutons en verre dépoli** (`.glass-pill`, `global.css`) : barre du bas, sélecteur de
  mode (Accueil/Focus/Ambiant et Pomodoro/Compte à rebours/Chronomètre, `variant="glass"`
  sur `SegmentedControl`) et contrôles du minuteur (`IconButton`) — fond gris/blanc
  translucide (~12 %) identique dans les deux thèmes, flou d'arrière-plan 20 px, bordure à
  peine visible, icônes `--glass-icon` (gris clair ~70 % en thème sombre, gris foncé en
  thème clair, plus claires/foncées au survol), jamais d'aplat de couleur — sauf la
  pastille active (accent, inchangé) et le bouton lecture/pause principal. Repli
  `prefers-reduced-transparency` : fond opaque `--surface`, sans flou.
- **Pages légales** en français, accessibles sans connexion sur des URL propres
  (`/conditions`, `/confidentialite`, `/mentions-legales`, routées comme `/admin` et
  `/diagnostic` dans `App.tsx`) : conditions d'utilisation, politique de confidentialité
  et mentions légales, sommaire, date de mise à jour, textes originaux fidèles au code
  (sous-traitants réels, données réellement traitées, aucun traceur). Informations que
  seul l'éditeur peut fournir marquées « [À COMPLÉTER] », jamais inventées. Liens en pied
  d'écran d'inscription et dans Réglages > À propos.
- **Consentement marketing** (`profiles.marketing_consent`/`marketing_consent_at`,
  migration `0038_marketing_consent.sql`) : case décochée par défaut à l'inscription,
  modifiable dans Réglages > Compte, même politique RLS propriétaire que le reste du
  profil.
- **Réglages > À propos** : version, liens légaux, lien vers le journal des changements,
  section Crédits (dérivée du registre des fonds — jamais de liste dupliquée — et des
  sons, marqués « à compléter » faute de métadonnées d'origine exploitables).

## 11. Défis et succès (V3)

### 11.1 Défis quotidiens
- Tirage de **N défis par jour**, remis à zéro à minuit (fuseau de l'utilisateur).
- Progression et validation **calculées automatiquement** à partir des sessions enregistrées.
- L'admin compose les défis à partir d'un **catalogue de conditions mesurables** avec un nombre à régler :
  - faire N sessions ;
  - faire une session d'au moins X minutes ;
  - cumuler X minutes de focus dans la journée ;
  - finir N tâches ;
  - rejoindre une session de groupe ;
  - garder sa série N jours.
- Un défi libre non mesurable n'est pas possible (il ne pourrait pas être validé).

### 11.2 Succès (badges)
- Mêmes conditions mesurables, à vie, avec paliers : **temps de focus cumulé** (4 h, 3 jours, 7 jours, 15 jours, 30 jours…), **séries de jours** (3, 7, 30…), **nombre d'amis suivis** (5, 15, 30), **sessions de groupe terminées**, **partages de l'app**, **1er du classement entre amis**.
- Barre de progression par succès, date d'obtention, icône dessinée à la main (Sullivan).
- Les noms et les visuels sont dans l'univers « quête du flow » ; liste complète et paliers définis avec l'admin.
- Récompense : badges et titres affichés sur le profil (pas de monnaie en V3).

## 12. Panneau Admin (V3)

Accessible uniquement avec `role = 'admin'`. Permet de créer, modifier, activer/désactiver et supprimer :
- **Thèmes** (nom, catégorie, mode, image/animation, aperçu) ;
- **Citations** (texte, auteur, catégorie) ;
- **Sons** d'alerte et d'ambiance ;
- **Défis** et **succès** ;
- **Nouveautés** (version, date, texte) ;
- **Messages du support** (lecture, statut traité/non traité) ;
- (V4) **Objets à collectionner** (§13).

Les modifications admin sont journalisées (qui, quoi, quand).

## 13. Collection d'objets (idée pour plus tard, à préparer dès maintenant)

Les utilisateurs collectionneront des **éléments médicaux** (anatomie, molécules, médicaments, microbes, instruments…) en terminant des sessions de focus. Rien de visible en V1-V3, mais l'architecture doit déjà l'accepter.

**Règles de conception retenues**
- Chaque session de focus terminée est un **événement enregistré** (`sessions` avec `completed`, durée, `group_session_id`). La collection s'y abonnera plus tard : aucune session ne doit être perdue ni recréée.
- Plusieurs **catégories**, des **niveaux de rareté** (commun, rare, épique, légendaire), des **probabilités gérées en base** (modifiables par l'admin).
- Mécanique de tirage à décider plus tard : aléatoire pur, durée = meilleures chances, et/ou garantie « pitié » (ex. un rare garanti après N sessions sans rare).
- **Tirage fait côté serveur** (fonction Edge) pour empêcher la triche.
- **Échanges** entre amis (proposition → acceptation, opération atomique), et **vitrine** publique ou entre amis pour exposer ses objets.
- **Contenu ajouté sans code** : un objet = une entrée en base + un visuel SVG ou PNG dessiné à la main par Sullivan.

**Tables prévues (non créées avant la V4)** : `item_categories`, `items`, `user_items`, `drops` (journal des gains), `trades`, `trade_items`, `showcases`.

## 14. Page de présentation (landing)

Page publique, accessible sans compte, dans l'esprit de Flocus et d'Outremed : une page d'accueil qui présente le produit puis envoie vers l'app.

- **En-tête** : logo Flowquest, navigation (Fonctionnalités, Aide, Contact), bouton **« Ouvrir Flowquest »**.
- **Héro** : slogan (à écrire), sous-titre « gratuit pour toujours », deux boutons (Ouvrir l'app, Créer un compte), capture de l'app.
- **Sections de fonctionnalités**, chacune avec une capture : timer et modes, thèmes et ambiances, tâches, statistiques, séries, sessions de groupe, amis et classement, défis et succès.
- Section **« Gratuit, vraiment »** : tout est inclus, sans offre payante.
- Section **« Installer sur ton iPad / ton téléphone »** : explication de l'ajout à l'écran d'accueil.
- **FAQ** courte et pied de page (contact, mentions légales, confidentialité, version).
- Responsive, très léger, bon score SEO ; routes séparées : `/` (landing), `/app` (l'application).

## 15. Modèle de données (V1 à V3)

Toutes les tables ont `id` (uuid), `created_at`, et le **RLS activé**.

- `profiles` : `id` (= auth.users.id), `username` (unique), `display_name`, `role` (`user`|`admin`), `timezone`, `stats_visibility`, `banned_at`, `friend_code` (unique, 8 car.), `avatar_version`, `invisible_mode`, `show_live_status`, `show_total_time_score`, `participate_leaderboard` ✅.
- `user_settings` : `user_id`, `settings` (jsonb : thèmes par mode, horloge, minuteur, extras…).
- `timer_state` : `user_id`, `mode`, `state`, `segment`, `started_at`, `duration`, `paused_total`, `task_id`, `updated_at`.
- `sessions` : `user_id`, `kind` (`focus`|`short_break`|`long_break`), `started_at`, `ended_at`, `planned_seconds`, `actual_seconds`, `completed`, `task_id`, `group_session_id`.
- `tasks` : `user_id`, `title`, `emoji`, `color`, `eta_minutes`, `parent_id`, `position`, `done`, `done_at`.
- `notes` : `user_id`, `content`, `updated_at`.
- `friendships` ✅ : `requester_id`, `addressee_id`, `status` (`pending`|`accepted`|`blocked`), `blocked_by`, `user_low`/`user_high` (générées, unicité de la paire).
- `live_status` ✅ : `user_id`, `state` (`focus`|`pause`|`inactive`), `started_at`, `duration_ms`, `updated_at` — publiée en Realtime.
- `cheers` ✅ : `sender_id`, `recipient_id`, `emoji` (cinq valeurs fixes), `read_at`, `created_at`.
- `weekly_leaderboard()` ✅ : fonction (pas de table), agrège `focus_sessions` à la demande pour soi et ses amis participants.
- Bucket Storage `avatars` ✅ : `{uid}/avatar.webp` (ou `.jpg`), public en lecture, écriture limitée à son propre dossier.
- `rooms` ✅ : `host_id`, `status` (`lobby`|`running`|`paused`|`ended`), `focus_minutes`, `started_at`, `duration_ms`, `elapsed_ms_at_pause`, `ended_at`.
- `room_participants` ✅ : `room_id`, `user_id`, `role` (`host`|`member`), `status` (`invited`|`joined`|`declined`|`left`|`abandoned`), `joined_at`, `left_at`, `last_seen_at`.
- `duo_streaks` ✅ : `user_low`, `user_high`, `current_streak`, `longest_streak`, `last_active_date`.
- `push_subscriptions` : `user_id`, `endpoint`, `keys`, `device`.
- `scheduled_alerts` : `user_id`, `fire_at`, `payload`, `sent`.
- `themes`, `quotes`, `sounds`, `session_tally_styles`, `changelog` : contenu géré par l'admin.
- `challenges`, `user_challenges`, `achievements`, `user_achievements` : définitions (condition + seuil) et progression.
- `support_messages` : `user_id` (nullable), `email`, `body`, `status`, `created_at`.
- `admin_log` : `admin_id`, `action`, `target`, `at`.

Vues ou fonctions SQL pour les stats (agrégats par période), le classement entre amis et le calcul des séries.

## 16. Sécurité et vie privée

- RLS partout : un utilisateur ne lit et n'écrit que **ses** lignes ; les amis voient uniquement les agrégats autorisés ; le contenu admin est en lecture publique, en écriture réservée au rôle `admin` (vérifié en base).
- Pas de secret dans le front (clés `service_role` exclusivement dans les Edge Functions).
- Validation côté serveur de la durée des sessions (pas de temps de focus fantaisiste).
- Limitation du débit sur la création de salles, les demandes d'amis et le formulaire de support.
- Les données personnelles se limitent au prénom, au pseudo et à l'e-mail.

## 17. Découpage en versions

### V1 : le cœur (utilisable seul, même sans compte)
- Landing de base (`/`) et app (`/app`), PWA installable.
- Modes Home / Focus / Ambiant, horloge et tous ses styles, salutations, citations.
- Minuteur : pomodoro, compte à rebours, chronomètre, reprise en arrière-plan, alertes sonores, Web Push de fin, PiP (essai).
- Thèmes prédéfinis, réglages complets, tâches, notes, sons d'ambiance (si retenus).
- Mode invité local, puis comptes (e-mail + Google) avec synchro.
- Stats de base, série, calendrier de focus.

### V2 : le social
- Amis (pseudo + code), classement entre amis, salles de groupe synchronisées.
- Task ETA (optionnel).

### V3 : le contenu et l'engagement
- Défis quotidiens, succès, panneau Admin complet, support, « Nouveautés », landing finalisée.

### V4 : la collection
- Objets, raretés, tirage serveur, échanges, vitrine (§13).

## 18. Décisions déjà prises (rappel)

- Nom : **Flowquest**. Français seul au départ.
- Un compte, un champ de rôle ; deux comptes réels (perso et admin).
- Mode invité oui. Pas de vidéos. Sons d'ambiance fournis par Sullivan s'ils sont légers.
- PWA + Web Push pour la fin de session ; popup discrète pour iOS et Android.
- PiP : on essaie, sans garantie sur Safari iPad.
- Salles : créateur contrôle par défaut, option « donner la main à tous » ; abandon explicite = annulation pour tous.
- Amis : pseudo + demande, ou code. Classement : période au choix, entre amis.
- Défis : catalogue de conditions mesurables. Support : réponses par e-mail.
- Hébergement : GitHub + Vercel + Supabase. Construction avec Claude Code.

## 19. Points à trancher plus tard

- Définition finale du **score de focus**.
- **Slogan** (à écrire). L'identité visuelle est **validée** : voir §20.
- Liste précise des thèmes de départ et des sons.
- Valeurs par défaut du pomodoro et nombre de sessions avant pause longue.
- Récompenses des succès (badges seuls, ou titres en plus).
- Mécanique de tirage de la collection (§13).
- Domaine personnalisé (optionnel, environ 10 €/an).

## 20. Identité visuelle (validée sur maquettes)

Les maquettes (Accueil, Focus, Réglages, en sombre et en clair) ont été validées par Sullivan. Ce paragraphe est la référence : en cas de doute, il prime sur toute inspiration Flocus.

### 20.1 Principes
- **Une seule couleur de marque : l'améthyste.** Pas d'autre teinte d'accent, pas de dégradé bleu-violet générique. Le thème clair utilise un violet clair, le sombre un violet profond.
- **Deux thèmes : sombre et clair**, choisis dans Thèmes > Apparence (Sombre / Clair / Système). Le thème par défaut suit le système.
- Pas d'emoji dans l'interface (hors compteurs de sessions choisis par l'utilisateur), pas de cartes toutes identiques, pas de rangées de trois cartes répétées.
- États complets à prévoir sur chaque composant : survol, focus clavier visible, désactivé, chargement, vide, erreur.

### 20.2 Jetons de couleur (variables CSS)

| Jeton | Sombre | Clair |
|---|---|---|
| `--bg` | `#0C0719` | `#F1EAFF` |
| `--surface` | `#1C1330` | `#F8F4FF` |
| `--surface-2` | `#291D47` | `#DFD2F5` |
| `--line` | `rgba(206,184,255,0.16)` | `rgba(74,32,140,0.16)` |
| `--text` | `#F2ECFC` | `#20103B` |
| `--muted` | `#A99BC8` | `#64548A` |
| `--accent` | `#A35CFF` | `#5A1FD1` |
| `--on-accent` | `#1A0B33` | `#FFFFFF` |
| `--glow` | `rgba(163,92,255,0.16)` | `rgba(90,31,209,0.14)` |
| `--contour` | `rgba(163,92,255,0.24)` | `rgba(90,31,209,0.24)` |
| `--scrim` | `rgba(12,7,25,0.62)` | `rgba(241,234,255,0.70)` |
| `--horizon` | `radial-gradient(120% 75% at 50% 112%, #6A3CC4 0%, #33196A 34%, #120C1E 72%)` | `radial-gradient(120% 75% at 50% 112%, #C7A4FF 0%, #DCCBF8 42%, #EFE9FC 80%)` |

Mis à jour au lot 2 (finitions) : améthyste plus vibrante sans virer au néon, tout en
gardant un contraste AA (texte courant ≥ 4,5:1) sur les deux thèmes — vérifié par calcul
(luminance relative WCAG) sur chaque paire texte/fond et accent/fond utilisée dans
l'interface. `--horizon` et les teintes d'échantillons (`--tone-a/b/c`, fonds de thèmes)
restent inchangés : seuls `--bg`, `--accent` et les tokens qui en dérivent directement
(`--glow`, `--contour`, `--scrim`) ont été retouchés.

Teintes d'échantillons de thèmes (aperçus de la bibliothèque) : `--tone-a / --tone-b / --tone-c` = `#2A1650 / #4B2A8A / #7A55C8` (sombre), `#C9B3F0 / #B497E8 / #E6DAFA` (clair).

**Le panneau Réglages est volontairement neutre** (graphite en sombre, blanc cassé en clair) pour ne pas être trop violet ; le violet n'y sert qu'à l'accent.

| Jeton du panneau | Sombre | Clair |
|---|---|---|
| `--panel-surface` | `#16141B` | `#FBFAFD` |
| `--panel-surface-2` | `#221F2B` | `#EEEAF6` |
| `--panel-line` | `rgba(255,255,255,0.10)` | `rgba(40,20,80,0.12)` |
| `--panel-text` | `#EEEAF4` | `#1E1830` |
| `--panel-muted` | `#9D98AC` | `#665F7C` |

Contrastes : texte courant ≥ 4,5:1, grand texte ≥ 3:1 sur les deux thèmes (à vérifier à l'intégration).

### 20.3 Typographie
- **Titres, horloge, minuteur : Bricolage Grotesque** (graisses 500 à 800, axe optique).
- **Interface et texte : Instrument Sans** (400, 500, 600).
- Pas d'Inter ni de Roboto. Polices auto-hébergées en production (même famille que le style d'horloge « Default »).
- Échelle fixe : **14 / 16 / 20 / 28 / 40 px** pour l'interface ; horloge calculée depuis une base de **208 px** (accueil) multipliée par la taille choisie (Petite ≈ **129 px**, Normale = 208 px, Énorme ≈ 281 px — Réglages > Horloge) — **Petite est la taille par défaut au lot 2** (anciennement Normale) — et minuteur à **176 px** (focus), graisse 800, interlettrage −0,04 em, chiffres tabulaires.
- Titres : interligne 1,1 à 1,2 ; texte : 1,4 à 1,5. Les deux-points de l'horloge sont en `--accent`, avec une marge de 0,1 em de chaque côté (ils ne doivent pas coller aux chiffres).
- Les 12 styles d'horloge et de minuteur (§7.2) restent des **préférences utilisateur** : l'identité ci-dessus est le style par défaut.

### 20.4 Espacement, formes, icônes
- Espacements en **multiples de 4 et 8 px**.
- **Boutons ronds** de 48 px (rayon 24 px) ; groupe de modes en **pastille** (rayon 26 px, boutons internes de 40 px) ; puces de filtre de 32 px ; panneaux et aperçus avec rayon 12 à 16 px. Une seule bordure fine (`--line`), pas d'ombre portée.
- **Icônes** : une seule famille, contour de **1,75 px**, extrémités arrondies, 20 à 22 px, couleur héritée (`currentColor`). Pas d'emoji ni d'icônes mélangées.
- Animations : transitions de **150 à 300 ms**, liées à une action ; pas d'apparition décorative ni de parallaxe.

### 20.5 Éléments signature (ce qui distingue Flowquest de Flocus)
- **Motif « courbes de niveau »** : lignes ondulées en fond, couleur `--contour`, évoquant le flow.
- **Fond par défaut « Horizon »** : lueur d'améthyste qui monte du bas de l'écran (`--horizon`), courbes de niveau par-dessus. Les autres fonds (Contours, Aubergine, Brume, Stries…) sont en CSS, dans la même teinte.
- **Progression en « sentier »** : dans le mode Focus, le temps écoulé se lit le long d'une ligne ondulée (SVG, `pathLength="100"`, trait d'accent) ; un point avance dessus (CSS `offset-path` + `offset-distance` calculés depuis la progression réelle).
- **Étapes de pomodoro** : les sessions d'un cycle sont des nœuds reliés par un trait (faits = pleins, en cours = cerclé, à venir = vide), à la place de simples points.
- **Menu Réglages** : s'ouvre **depuis la gauche** (≈ 880 px) sur un fond estompé (`--scrim`) ; colonne de navigation de 264 px, l'onglet actif a un fond `--panel-surface-2` et un trait d'accent de 3 px à gauche.

### 20.6 Mise en page des écrans
- **Accueil** : nom en haut à gauche ; citation en haut à droite (texte + auteur) ; au centre, salutation (28 px), phrase secondaire, horloge, date ; en bas à gauche, tâches et notes ; en bas à droite, série (flamme + nombre), sélecteur de mode (ambiant, accueil, focus), réglages, plein écran.
- **Focus** : même cadre ; au centre, « Sur quoi te concentres-tu ? », tâche active, onglets Focus / Pause courte / Pause longue (soulignement d'accent sur l'actif), étapes du cycle, minuteur, sentier de progression, commandes (réinitialiser, pause/lecture en bouton principal rond de 64 px, passer, image dans l'image).
- **Réglages > Thèmes** : titre 40 px ; apparence (segment Sombre / Clair / Système) ; onglets Accueil / Focus / Ambiant ; aperçu en direct (horloge sur le fond choisi) ; bibliothèque filtrable avec une grande vignette (fond actuel) et des vignettes plus petites, asymétriques.
- **Mode ambiant** : non maquetté ; mêmes principes, minuteur compact en carte en haut à droite.
- **Responsive** : vérifier 360 px, tablette (iPad en priorité) et ordinateur ; sur petit écran, la navigation des réglages passe au-dessus du contenu.
- Hauteur plein écran en `100dvh` (pas `100svh`) : Safari iPad/iPhone redimensionne sa barre
  d'outils en scrollant, et `svh` reste figée sur le pire cas (barre affichée), laissant une
  bande vide en bas quand elle se masque. `dvh` suit la hauteur réellement visible. Corrigé
  au lot 3 (bug remonté sur le fond « Respiration », mais le conteneur racine concerné est
  partagé par tous les fonds).

### 20.7 Contenu initial
- Citation de départ : « La vie est brève, l'art est long. » (Hippocrate), les suivantes viennent de l'admin.
- Les textes français sont dans un fichier de traduction (§2). Les phrases d'accueil dépendent de l'heure et du jour (§5.1).
- Les maquettes sont sur un canvas Claude privé (« Flowquest maquettes ») : à consulter par Sullivan, non lisible par Claude Code. **Les jetons ci-dessus font foi.**
