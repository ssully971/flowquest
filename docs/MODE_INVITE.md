# Mode invité : entonnoir de conversion

Un utilisateur non connecté (« invité ») teste la base de l'outil ; les fonctions avancées
restent visibles avec un cadenas et ouvrent, au clic, une modale qui l'invite à créer un
compte (bêta fermée : code d'invitation requis tant que le drapeau `beta_fermee` est actif).

## Règle de verrouillage (une seule définition)

`isGuestLocked(status, isSupabaseConfigured)` dans `src/features/access/feature-access.ts` :

> verrouillé **si et seulement si** `status === 'guest'` **et** `isSupabaseConfigured`.

- Supabase non configuré (déploiement 100 % local) : rien n'est verrouillé, sinon personne ne
  pourrait jamais débloquer ces fonctions.
- `status === 'loading'` : ni cadenas ni modale (pas de flash chez un utilisateur connecté).
- Compte connecté (admin compris) : aucune restriction.
- La connexion déverrouille immédiatement, sans rechargement.

On verrouille l'**usage**, jamais les **données** : rien n'est supprimé ni réécrit
(tâches, réglages, `deepFocusEnabled`…). L'enregistrement local des sessions de l'invité
continue même statistiques verrouillées : c'est ce que reprend `guest-import.ts` à
l'inscription.

## Fonctionnalités concernées (`LockableFeature`)

| Clé             | Point(s) d'entrée verrouillé(s)                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `stats`         | bouton série/flamme + `StreakPanel` (`AppShell`), entrée « Stats » de `SettingsPanel`, Équilibre et Galaxie dans `PillarsPage`    |
| `tasks`         | bouton Tâches + `TasksPanel` (`AppShell`) ; la tâche active est servie à `null` par `ActiveTaskProvider` (valeur stockée intacte) |
| `ambientSounds` | bouton Sons + `AmbientSoundsPanel` (`AmbientScreen`) ; la touche M est inerte                                                     |
| `deepFocus`     | interrupteur de `TimerPage` (affiché éteint) ; `FocusScreen`, `AmbientScreen` et `GameCampaignBanner` le traitent comme désactivé |

Restent libres : minuteur Pomodoro et ses raccourcis, écran Ambiant (sans mixeur), citations,
piliers, horloge, thèmes, sauvegarde locale, Mode Amis, etc.

## Pièces

- `useFeatureAccess()` : `isLocked(feature)` et `requireAccount(feature)` (ouvre la modale et
  renvoie `false` si verrouillé). Sans `AuthProvider` (tests isolés), rien n'est verrouillé.
- `UpsellProvider` (monté par `AuthGateRequestProvider`) : un seul état de modale pour tout le
  site, focus rendu au déclencheur à la fermeture. `UpsellModal` : `role="dialog"`, focus
  piégé, Échap et clic sur le fond, pas de défilement de l'arrière-plan, mention de bêta
  fermée seulement si `beta_fermee` est actif.
- `requestSignIn(view?)` (`useAuthGateRequest`) : `'signIn'` (défaut) ou `'signUp'` ;
  `AuthGate` s'ouvre sur la vue demandée.
- `LockedBadge` (cadenas + `LOCKED_DIM_CLASS`) et `LockedBlock` (encart qui remplace une
  section entière). Un élément verrouillé n'est **jamais** `disabled` (il doit recevoir le clic).

## Ajouter une fonctionnalité verrouillée

1. Ajouter sa clé à `LockableFeature` (`feature-access.ts`) et son libellé à
   `strings.access.features` (`fr.ts`).
2. Dans le composant : `const { isLocked, requireAccount } = useFeatureAccess()`.
3. Au clic / à la touche : `if (!requireAccount('maClé')) return` **avant** d'ouvrir la fonction.
4. Rendu verrouillé : `LockedBadge` + `LOCKED_DIM_CLASS`, `aria-label` =
   `` `${libellé}${strings.access.lockedSuffix}` ``, sans `disabled`, et ne pas monter le panneau.
5. Si la fonction a un moteur (hook, son…), le traiter comme désactivé quand `isLocked`, sans
   réécrire de donnée stockée.
6. Tester les quatre cas : invité, connecté, chargement, Supabase non configuré.
