# Mode Amis — Fokitsu

Document de référence du Mode Amis (profil social, amis, statut en direct, classement,
salons de focus, série partagée — V2 du cahier des charges, §10). Mis à jour à chaque lot
(F1 à F4). Pour le détail politique par politique, voir `docs/SECURITE.md` (source de
vérité pour les RLS) ; ce document se concentre sur le modèle de données et les règles
produit/vie privée.

## Statut

| Lot | Contenu | État |
|---|---|---|
| F1 | Profil, photo, amis, vie privée | ✅ Livré |
| F2 | Statut en direct, encouragements, classement | ✅ Livré |
| F3 | Salons de focus ensemble | ✅ Livré |
| F4 | Série partagée, finitions | ✅ Livré |

## Modèle de données (F1 + F2 + F3 + F4)

### `profiles` (étendue)

Colonnes ajoutées par les migrations `0019`/`0020` (aucune nouvelle table pour le profil
lui-même — réutilise la table existante, au même titre que `stats_visibility` déjà là) :

| Colonne | Type | Rôle |
|---|---|---|
| `banned_at` | `timestamptz \| null` | Modération (voir plus bas). |
| `friend_code` | `text` (8 car., unique) | Code ami : alphabet sans caractères ambigus (`A-HJ-NP-Z2-9`, exclut `0`/`O`/`1`/`I`), généré automatiquement à la création du compte, régénérable. |
| `avatar_version` | `integer` | Contourne le cache d'image après upload/suppression (`?v=` dans l'URL) — recalculé par un trigger, jamais pris tel quel depuis le client. |
| `invisible_mode` | `boolean` (défaut `false`) | Aucun statut en direct, absent des classements — voit quand même ses amis. |
| `show_live_status` | `boolean` (défaut `true`) | Statut en direct visible de ses amis (LOT F2). |
| `show_total_time_score` | `boolean` (défaut `true`) | Temps total et score visibles sur sa fiche, pour ses amis. |
| `participate_leaderboard` | `boolean` (défaut `true`) | Apparaît dans le classement hebdomadaire entre amis (LOT F2). |

### `friendships` (nouvelle, migration `0021`)

| Colonne | Rôle |
|---|---|
| `requester_id` / `addressee_id` | Direction de la demande d'origine. |
| `status` | `pending` \| `accepted` \| `blocked`. |
| `blocked_by` | Qui a posé le blocage (distinct de requester/addressee : un ami de longue date peut bloquer l'autre). |
| `user_low` / `user_high` | Colonnes générées (`least`/`greatest` des deux id) : unicité de la paire quel que soit le sens, et cible `ON CONFLICT` pour `block_user()`. |

Aucune ligne n'est jamais écrite directement par le client : tout passe par les fonctions
`send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `remove_friend`,
`block_user`, `unblock_user` (détail des règles ci-dessous).

### `support_messages` (étendue, migration `0023`)

Réutilisée pour le signalement d'utilisateur (`category = 'report'`, `reported_user_id`)
plutôt qu'une nouvelle table — mêmes raisons qu'un message de contact : l'admin les traite
au même endroit.

### Storage : bucket `avatars` (migration `0024`)

Un fichier par utilisateur, chemin fixe `{uid}/avatar.webp` (ou `.jpg` en repli) — jamais de
nom versionné, le contournement du cache se fait via `profiles.avatar_version` dans l'URL.
Public en lecture (URL directe), mais non listable (voir `docs/SECURITE.md`).

### `live_status` (nouvelle, migration `0025`)

| Colonne | Rôle |
|---|---|
| `user_id` | Clé primaire — une ligne par compte. |
| `state` | `focus` \| `pause` \| `inactive`. « Hors ligne » n'est **pas** une valeur de cette colonne : calculé à la lecture (`updated_at` de plus de 2 minutes), jamais stocké. |
| `started_at` | Début de l'état courant (repart à chaque transition). |
| `duration_ms` | Durée prévue du segment en cours, si connue (reprend `durationMs` du moteur du minuteur). |
| `updated_at` | Battement de cœur — mis à jour au démarrage/pause/reprise/fin de session et au moins toutes les 60 s. |

Ajoutée à la publication `supabase_realtime` : les amis reçoivent les changements en direct
(filtrés par RLS, voir `docs/SECURITE.md`), avec repli par interrogation toutes les 30 s si
le canal Realtime tombe, et reconnexion à chaque retour au premier plan de l'onglet.

### `cheers` (encouragements, nouvelle, migration `0026`)

| Colonne | Rôle |
|---|---|
| `sender_id` / `recipient_id` | Toujours entre amis (vérifié par `send_cheer()`). |
| `emoji` | Un des cinq fixes : 💪 🔥 👏 ❤️ ☕. |
| `read_at` | `null` tant que non lu — marqué en bloc par `mark_cheers_read()`, pas un par un. |

### `weekly_leaderboard()` (classement, migration `0027`)

Fonction, pas de table : agrège `focus_sessions` à la demande pour l'appelant et ses amis
participants. Voir `docs/SECURITE.md` pour la formule de score et son écart assumé avec le
score personnel de la page Stats.

### `rooms` et `room_participants` (salon de focus ensemble, nouvelles, migration `0028`)

| Table | Colonne | Rôle |
|---|---|---|
| `rooms` | `status` | `lobby` → `running` ⇄ `paused` → `ended`. |
| `rooms` | `focus_minutes` | Durée choisie par l'hôte à la création (5 à 120 min). |
| `rooms` | `started_at` / `duration_ms` | Même principe que `live_status` : le compte à rebours est toujours recalculé depuis ces deux valeurs, jamais accumulé côté client — résiste à la suspension d'onglet. |
| `rooms` | `elapsed_ms_at_pause` | Temps déjà écoulé au moment de la pause, pour reprendre exactement là où on s'était arrêté. |
| `room_participants` | `role` | `host` (un seul à la fois) ou `member`. |
| `room_participants` | `status` | `invited` → `joined` (ou `declined`) → `left`/`abandoned`. |
| `room_participants` | `last_seen_at` | Battement de cœur du salon (mis à jour par `get_room_state()`, pas lié au statut en direct personnel du LOT F2) — silence de plus de 2 minutes pendant que le salon tourne = abandon détecté. |

Fonctions (`0029_rooms_rpc.sql`, durcie par `0033` — voir plus bas) : `create_room`,
`respond_room_invite`, `start_room`, `pause_room`, `resume_room`, `end_room`,
`transfer_host`, `leave_room`, `list_my_rooms`, `get_room_state`. Voir `docs/SECURITE.md`
pour le détail des politiques et de l'entretien paresseux (`_room_tick`).

### `duo_streaks` (série partagée, nouvelle, migration `0031`)

| Colonne | Rôle |
|---|---|
| `user_low` / `user_high` | Paire d'amis (mêmes colonnes génératrices least/greatest que `friendships`), clé primaire. |
| `current_streak` | Jours consécutifs où les deux ont chacun complété une session de focus. |
| `longest_streak` | Record de la paire, survit à une remise à zéro de `current_streak`. |
| `last_active_date` | Dernier jour (America/Guadeloupe) compté pour la paire. |

Entretenue par un trigger sur `focus_sessions` (`bump_duo_streaks()`, migration `0031`),
pas recalculée à chaque lecture sur tout l'historique — voir `docs/SECURITE.md` pour le
détail et la justification de ce choix. Fonction de lecture : `list_duo_streaks()`
(migration `0032`), avec remise à zéro paresseuse des séries interrompues.

## Règles produit

### Amis

- Ajout par **code ami** (8 caractères) ou par **pseudo exact** — jamais de recherche
  partielle, pour ne pas permettre d'énumérer les comptes.
- Un aperçu (avatar, pseudo, nom affiché) confirme l'identité avant l'envoi réel de la
  demande.
- **Quota** : 20 demandes envoyées par compte et par jour glissant (24 h), pour limiter le
  spam de demandes.
- Si la personne visée a déjà envoyé une demande dans l'autre sens, la demande en cours
  l'accepte directement plutôt que de créer deux demandes croisées.
- **Blocage** : le compte bloqué ne peut plus renvoyer de demande tant que le blocage n'est
  pas levé par celui qui l'a posé — et un message générique (« Compte introuvable »), jamais
  « tu es bloqué », pour ne pas révéler le blocage.
- **Signalement** : formulaire court (texte libre) créant un message visible dans l'admin,
  catégorie `report`, limité à 10 signalements par compte et par jour.

### Vie privée (Réglages > Amis et confidentialité)

Quatre réglages indépendants, stockés dans `profiles` et appliqués côté base (jamais
seulement côté interface) :

1. **Mode invisible** — aucun statut en direct, absent des classements, voit quand même ses
   amis (prioritaire sur les trois réglages suivants quand actif).
2. **Montrer mon statut en direct** — déjà limité aux amis acceptés par construction (voir
   `are_friends()`) ; ce réglage permet de le masquer même d'eux.
3. **Montrer mon temps total et mon score** — sur sa fiche, pour ses amis (indépendant de la
   participation au classement : on peut se classer sans exposer le détail, ou l'inverse).
4. **Participer au classement** — apparition dans le classement hebdomadaire entre amis.

Valeurs par défaut **prudentes** : visible des amis uniquement (jamais public au-delà),
classement activé par défaut (c'est le principe central du Mode Amis), mode invisible
désactivé par défaut.

### Statut en direct

- Mis à jour au démarrage, à la pause, à la reprise et à la fin d'une session, avec un
  battement de cœur toutes les 60 s même sans changement — lecture passive de l'état
  persisté du minuteur (`useGlobalTimerState`, sondé toutes les 15 s), jamais une nouvelle
  instance du minuteur : reste exact quel que soit l'écran affiché (Focus, Ambiant,
  Accueil).
- Visible uniquement des amis acceptés qui y ont droit (ni bloqué, ni `show_live_status`
  désactivé, ni mode invisible).
- Sur la liste d'amis : un point de couleur (vert en focus, ambre en pause) et « en focus
  depuis 12 min » — **jamais** le détail de ce qui est étudié.

### Encouragements

- Jeu fixe de cinq emojis, envoyables uniquement entre amis.
- Quotas : 1 par destinataire toutes les 10 minutes, 30 par jour au total.
- Jamais de notification pendant que le destinataire est en focus (`useGlobalTimerState`
  sert aussi de garde ici) : affichés en bandeau groupé à la fin de sa session ou à
  l'ouverture de l'app, marqués lus tous ensemble à la fermeture du bandeau.

### Classement hebdomadaire

- Moi (toujours inclus) + mes amis ayant activé `participate_leaderboard` (et pas en mode
  invisible).
- Semaine du lundi au dimanche, fuseau America/Guadeloupe — semaine en cours ou précédente
  seulement (pas d'historique plus ancien dans ce lot).
- Score = taux d'achèvement × (0,7 + 0,3 × régularité sur les 7 jours de la semaine) × 100,
  calculé côté base (`weekly_leaderboard()`), jamais recalculé côté client.
- Affiché avec ma position mise en évidence, une barre de progression relative au meilleur
  score de la semaine, et un message adapté à mon classement. Les ex æquo partagent le même
  rang (`rank()` SQL, pas `row_number()`).

### Salons de focus ensemble

- Un salon réunit l'hôte et jusqu'à 5 amis invités (6 personnes au plus, hôte compris) —
  volontairement restreint pour ce premier lot.
- Invitation uniquement entre amis (`are_friends()`), jamais par un code ou un lien
  public : les salons restent dans le périmètre du Mode Amis.
- **Une seule session de focus par salon**, sans enchaînement de pauses dans ce lot : pas
  de cycle Pomodoro complet partagé pour l'instant (voir « Pas encore couvert »).
- **Contrôles réservés à l'hôte** : démarrer, mettre en pause, reprendre, terminer —
  vérifié côté base (`rooms.host_id`), jamais seulement par l'interface masquant les
  boutons.
- **Minuteur partagé** : tous les participants voient le même compte à rebours, calculé
  depuis `started_at`/`duration_ms` (jamais accumulé localement) — reste exact même après
  une suspension d'onglet ou un changement d'appareil.
- **Transfert d'hôte** : explicite à tout moment (« Nommer hôte »), ou automatique si
  l'hôte reste silencieux plus de 3 heures (voir « Gestion de l'abandon » ci-dessous) — le salon ne reste jamais bloqué sans personne aux commandes.
- **Gestion de l'abandon** (révisée au LOT M1, migration `0048`) : un participant `joined`
  dont le battement de cœur (`room_participants.last_seen_at`) date de plus de **3 heures**
  est marqué « abandoned » (appareil éteint, application supprimée). Si c'était l'hôte, son
  rôle est transféré (ou le salon est clôturé si plus personne n'y est). Avant le LOT M1 le
  seuil était de 2 minutes, ce qui faisait « partir » du salon quiconque fermait l'écran ou
  suspendait l'onglet. « Présent » (pastille verte) reste calculé sur 2 minutes : simple
  indicateur d'affichage, sans effet sur l'appartenance au salon.
- **Fermer l'écran du salon, changer de page, suspendre l'onglet ne quitte JAMAIS le
  salon** : le salon vit côté serveur, l'écran n'en est qu'une vue. Un battement de cœur
  global (`useRoomPresence`, monté dans AppShell, RPC `touch_my_rooms()`) signale la
  présence toutes les 30 s onglet visible et au retour au premier plan, quel que soit
  l'écran. Seuls « Quitter » et « Terminer » (boutons explicites) font quitter ou clôturer.
- Aucun détail de tâche n'est jamais partagé dans un salon, seulement les avatars, pseudos
  et le minuteur commun.
- **Un salon sans invité n'a pas de sens** (finition LOT F4) : `create_room()` refuse
  désormais une liste d'invités vide (migration `0033`), et le bouton « Créer le salon »
  reste désactivé côté interface tant qu'aucun ami n'est coché.

### Série partagée

- Affichée directement sur la liste d'amis (pas d'onglet dédié) : une flamme 🔥 à côté du
  pseudo, avec le nombre de jours — en couleur si le jour est déjà fait (`active_today`),
  en gris sinon (rappel qu'il reste à faire une session aujourd'hui pour ne pas la perdre).
- Un jour compte dès que **chacun** des deux amis a complété au moins une session de focus
  ce jour-là (voir `docs/SECURITE.md` pour la définition exacte et pourquoi elle diffère
  de la série personnelle).
- Mise à jour en temps réel (Supabase Realtime sur `duo_streaks`) : la série de l'ami
  avance sans recharger le panneau si lui complète une session pendant que tu le regardes.
- Les sessions complétées dans un salon de focus (F3) ne comptent **pas** pour l'instant
  (les salons n'écrivent pas dans `focus_sessions`, voir « Pas encore couvert » du LOT F3)
  — une évolution possible, pas construite dans ce lot.

### Comptes bannis

Un compte banni (`profiles.banned_at` non nul, vérifié par `is_banned()`) :

- n'apparaît dans **aucune** liste (amis, demandes, aperçu de recherche, classement,
  statut en direct, participants d'un salon) ;
- ne peut envoyer **aucune** demande d'ami, ni aucune action du Mode Amis ;
- reste visible de lui-même tant qu'il est connecté, mais toute action côté base échoue.

`is_banned()` et les RPC `admin_ban_user`/`admin_unban_user` n'existaient pas avant ce lot
(ajoutées par la migration `0019_moderation.sql`, nécessaires pour que cette règle soit
réellement appliquée plutôt qu'une promesse vide) — pas encore d'écran admin dédié pour
bannir (les fonctions sont appelables depuis le SQL Editor ou la console du navigateur en
attendant).

## Avatar

- Recadrage carré (zoom + déplacement) côté navigateur avant tout envoi — rien n'est
  transmis tel quel.
- Réduction à 256×256, encodage WebP qualité ~0,8 visant ≤ 40 Ko (repli JPEG si le
  navigateur ne sait pas exporter de WebP).
- Passage systématique par un `<canvas>` : supprime les métadonnées EXIF (position, modèle
  d'appareil...) sans étape dédiée — propriété du pipeline `drawImage` + `toBlob`.
- Avatar par défaut généré (initiales sur une couleur déduite de l'identifiant du compte) —
  jamais de case vide, y compris si l'image échoue à charger.
- Un admin peut retirer la photo d'un utilisateur (`admin_remove_avatar`, journalisé).

## Composants partagés

- `Avatar` (`src/features/avatar/components/Avatar.tsx`) : seul composant d'avatar dans
  toute l'app, tailles `xs` à `xl`, point de statut optionnel — branché depuis le LOT F2
  (`statusDotColor`/`statusLabel`, voir `FriendCard`).
- `are_friends(a, b)` (SQL) : brique centrale réutilisée par toute politique RLS ou
  fonction ayant besoin de savoir si deux comptes sont amis (et ni l'un ni l'autre banni) —
  `live_status`, `send_cheer()`, `weekly_leaderboard()` (F2), `create_room()` (F3), série
  partagée (F4).
- `useGlobalTimerState` (`src/features/timer/useGlobalTimerState.ts`) : lecture passive et
  partagée de l'état du minuteur (focus/pause/inactif), sans instancier un nouveau
  `TimerController` — utilisée à la fois par le battement de cœur du statut en direct
  (`useLiveStatusSync`) et pour différer l'affichage des encouragements pendant le focus
  (`useCheers`).
- `useRealtimeSync` (`src/shared/supabase/useRealtimeSync.ts`) : brique générique extraite
  de `useFriendsRealtime` (F2) lors du LOT F3 — resynchronisation complète (rechargement +
  nouvelle connexion) sur `visibilitychange`, `pageshow`, `focus` et `online`, repli par
  interrogation toutes les 4 s tant que le canal n'est pas SUBSCRIBED (LOT M1, avant : 30 s),
  filet d'interrogation optionnel même canal ouvert (`safetyPollMs`, activé pour les salons),
  canal et écouteurs paramétrables. `useFriendsRealtime`,
  `useRoomRealtime` (F3, un canal par salon filtré sur `room_id`) et `useDuoStreaks` (F4,
  statut en direct de la série partagée) en sont trois fines enveloppes — confirmé
  réutilisable tel quel comme annoncé lors du LOT F3.
- Le minuteur partagé d'un salon (`room-timer.ts`, F3) suit le même principe que le
  minuteur individuel : toujours recalculé depuis `started_at`/`duration_ms`/
  `elapsed_ms_at_pause`, jamais accumulé côté client — un tick local d'une seconde ne sert
  qu'à rafraîchir l'affichage, jamais au calcul lui-même.

## Pas encore couvert

Le Mode Amis V1 (lots F1 à F4) est livré en entier. Reste volontairement hors périmètre :

- Interface admin dédiée pour bannir/débannir un compte.
- Historique du classement au-delà de la semaine précédente.
- Partage optionnel du détail de la tâche en cours dans le statut en direct (évoqué par le
  cahier des charges — « sauf s'il l'a choisi » — non construit : aucune case à cocher
  n'existe encore pour ça, le comportement par défaut « jamais » suffit pour l'instant).
- Salons : enchaînement automatique de pauses après la session de focus (une seule session
  par salon dans ce lot), retrait d'un participant par l'hôte (« kick »), minimisation du
  salon en arrière-plan en continuant à naviguer dans l'app, et intégration du temps passé
  en salon aux statistiques personnelles/à la série individuelle (décision produit
  délibérément laissée de côté pour ce lot, pour ne pas coupler deux systèmes sans spec
  explicite sur la façon de compter une session partagée).
- Série partagée : pas de rappel/notification quand la série est sur le point d'être
  perdue (ex. « il te reste 3 h pour ne pas perdre ta série avec Léa ») — la flamme grise
  sur la liste d'amis sert d'indice visuel passif en attendant.

## Temps réel : cause racine du LOT M1

Symptôme : les demandes d'ami arrivaient en direct, pas la création d'un salon ni
démarrage/pause. Causes (migration `0048_rooms_realtime_fix.sql`) :

1. **Récursion RLS** — la politique SELECT de `room_participants` relisait sa propre table
   (« infinite recursion detected in policy for relation »). Les RPC `SECURITY DEFINER`
   fonctionnaient (d'où un chargement correct), mais Realtime évalue la politique pour
   chaque abonné : tous les évènements de `rooms`/`room_participants` étaient perdus.
   Correctif : helper `is_room_participant()` (`SECURITY DEFINER`).
2. **`live_status`** — sa politique relisait `profiles` sous la RLS du lecteur (qui ne voit
   que sa propre ligne) : jamais d'évènement pour les amis. Correctif : `can_see_live_status()`.
3. **`useRealtimeSync`** — le rappel `CLOSED` réarmait un intervalle après le nettoyage
   (fuite), pas de repli pendant la connexion, repli à 30 s, rien sur `online`/`pageshow`.
4. **Le salon « s'arrêtait » quand on quittait la page** — le battement de cœur n'existait
   que dans `get_room_state()` (appelé par l'écran ouvert) et l'abandon tombait à 2 minutes.
5. `REPLICA IDENTITY FULL` sur `rooms`, `room_participants`, `live_status`.

Test SQL : `supabase/tests/rooms_realtime.sql`.
