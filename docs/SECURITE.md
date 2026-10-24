# Sécurité — Flowquest

Référence des politiques RLS (Row Level Security) et des règles de sécurité appliquées
côté base de données Supabase. Toute vérification d'accès vit ici, jamais seulement
côté interface : même un bug ou une manipulation du client ne doit jamais permettre à
un utilisateur de lire ou modifier les données d'un autre.

## Principes

- RLS **activée sur toutes les tables** dès leur création (`alter table ... enable row level security`).
- Aucune politique « permissive par défaut » : sans politique explicite, Postgres refuse
  tout accès. Chaque table liste donc ses politiques une par une ci-dessous.
- RLS n'est que la moitié de la protection : chaque table a aussi besoin d'un `GRANT`
  PostgreSQL explicite pour `authenticated`/`anon`, sans quoi Postgres refuse la requête
  **avant même d'évaluer RLS** (erreur `42501`, déjà rencontrée en production — voir
  « Droits PostgreSQL (GRANT) » plus bas et `docs/DIAGNOSTIC-SUPABASE.md`).
- Aucune clé `service_role` dans le front (voir `.env.example` et `src/shared/supabase/client.ts`) :
  seule la clé `anon`, toujours soumise aux politiques RLS, est utilisée côté site.
- Le rôle (`profiles.role`) ne peut **jamais** être modifié par une requête authentifiée
  côté client, même sur sa propre ligne — voir « Rôle admin » plus bas.

## Tables et politiques

### `profiles`

| Opération | Règle |
|---|---|
| SELECT | `auth.uid() = id` — un utilisateur ne lit que son propre profil. |
| INSERT | `auth.uid() = id` — un utilisateur ne peut créer que sa propre ligne (en pratique, c'est le trigger `handle_new_user` qui la crée à l'inscription). |
| UPDATE | `auth.uid() = id` — un utilisateur ne modifie que son propre profil. |
| DELETE | Aucune politique : pas de suppression directe (la suppression de compte passe par `auth.admin.deleteUser`, qui cascade via la contrainte `on delete cascade`). |

**Mode Amis (LOT F1)** : la politique SELECT ci-dessus n'a **pas** changé — elle reste
strictement `auth.uid() = id`, même entre amis. Les lectures inter-utilisateurs nécessaires
aux fonctionnalités sociales (liste d'amis, demandes, aperçu avant ajout) passent par des
fonctions `SECURITY DEFINER` à champs restreints (`list_friends()`, `list_friend_requests()`,
`find_profile_preview()` — migration `0022_friend_lookup.sql`), jamais par un élargissement
de cette politique. C'est le principe déjà appliqué à `is_username_available()` (migration
`0012`) : jamais assouplir la politique RLS de la table elle-même pour exposer une colonne,
toujours une fonction dédiée qui ne renvoie que ce qui est nécessaire.

Nouvelles colonnes (migrations `0019`/`0020`) : `banned_at` (modération, voir plus bas),
`friend_code` (code ami unique de 8 caractères, généré automatiquement — trigger
`profiles_set_friend_code`), `avatar_version` (contournement du cache d'image, recalculé
automatiquement par le trigger `profiles_bump_avatar_version`, jamais pris tel quel depuis
la requête du client), et les 4 réglages de vie privée (`invisible_mode`,
`show_live_status`, `show_total_time_score`, `participate_leaderboard`) — tous modifiables
par le propriétaire via la politique `profiles_update_own` déjà existante, comme
`username`/`display_name`/`avatar_url`.

**Filet de sécurité `ensure_profile()`** (migration `0009_ensure_profile.sql`, SECURITY
DEFINER) : si la ligne `profiles` d'un utilisateur connecté manque (compte créé avant que
le trigger `handle_new_user` n'existe, ou tout autre aléa), le client l'appelle en repli
pour créer la ligne manquante — jamais une autre que celle de `auth.uid()`, lu uniquement
depuis le jeton de la requête, jamais depuis un paramètre. `docs/DIAGNOSTIC-SUPABASE.md`
donne la procédure de vérification manuelle.

### Rôle admin

- `profiles.role` a un trigger `prevent_role_self_escalation` (migration `0002_profiles.sql`)
  qui lève une exception si `role` change **et** que `auth.uid()` est non nul (c'est-à-dire
  si la requête passe par PostgREST avec un jeton utilisateur, donc par l'app).
- `auth.uid()` est NULL quand une requête est exécutée depuis l'éditeur SQL Supabase
  (connecté en tant que `postgres`) : c'est le **seul** chemin autorisé pour passer un
  compte en admin. Voir `supabase/make_admin.example.sql`.
- La fonction `public.is_admin(uid uuid default auth.uid())` (migration `0003_is_admin.sql`)
  est `security definer` : elle peut lire `profiles.role` sans déclencher de récursion RLS,
  et sert de brique pour toute politique réservée aux admins — utilisée par `quotes`,
  `changelog`, `admin_log` et l'accès admin à `support_messages` (panneau Admin, §12).
- Côté interface, `/admin` (`src/features/admin/AdminGate.tsx`) est protégée en lisant
  `profile.role` (chargé via `profiles_select_own`, donc fiable : cette politique ne
  renvoie jamais que la ligne du compte connecté lui-même). **Cette garde est un confort
  de navigation, pas une barrière de sécurité** — la vraie barrière, pour toute future
  table de contenu réservée aux admins, est RLS + `is_admin()` côté base.

### Modération (bannissement)

- `profiles.banned_at` (migration `0019_moderation.sql`) : `null` tant que le compte n'est
  pas banni. `public.is_banned(uid uuid default auth.uid())` est le pendant exact de
  `is_admin()` (même forme, même `security definer`) et sert de garde dans **toute**
  fonction ou politique du Mode Amis — un compte banni ne peut ni envoyer de demande, ni
  apparaître dans une recherche, une liste d'amis ou un aperçu (voir `are_friends()`,
  `send_friend_request()`, `list_friends()`, `find_profile_preview()`...).
- `admin_ban_user(p_target_user_id, p_reason)` / `admin_unban_user(p_target_user_id)` :
  réservées à `is_admin()`, journalisées dans `admin_log` comme toute action admin. Pas
  d'interface admin dédiée pour l'instant (à ajouter si besoin) — ces fonctions sont
  appelables via le SQL Editor ou `supabase.rpc(...)` depuis la console du navigateur en
  attendant.

### `user_settings`

| Opération | Règle |
|---|---|
| SELECT / INSERT / UPDATE / DELETE | `auth.uid() = user_id` dans tous les cas. |

`settings` est un `jsonb` avec un `schema_version` : un changement de forme des réglages
(ajout de champ, renommage) s'accompagne d'une migration de lecture côté client qui sait
interpréter les anciennes versions, jamais d'une réécriture destructive en base.

### `tasks`

| Opération | Règle |
|---|---|
| SELECT / INSERT / UPDATE / DELETE | `auth.uid() = user_id` dans tous les cas. |

`parent_id` référence `tasks.id` (sous-tâches) avec `on delete cascade` : supprimer une
tâche supprime ses sous-tâches, jamais celles d'un autre utilisateur (la contrainte
`user_id` protège chaque ligne indépendamment).

### `focus_sessions`

| Opération | Règle |
|---|---|
| SELECT / INSERT / UPDATE / DELETE | `auth.uid() = user_id` dans tous les cas. |

Une session s'écrit en deux temps (créée au lancement du minuteur, puis mise à jour à la
fin avec `actual_seconds`/`ended_at`/`completed`) : la politique UPDATE est nécessaire,
mais reste strictement limitée au propriétaire. `group_session_id` est une colonne
réservée (V2 salles de groupe, V4 collection — §13 du cahier des charges) : aucune session
existante n'aura besoin d'être recréée quand ces fonctionnalités arriveront.

### `timer_state`

| Opération | Règle |
|---|---|
| SELECT / INSERT / UPDATE / DELETE | `auth.uid() = user_id` dans tous les cas. |

Une seule ligne par utilisateur (`user_id` est la clé primaire) : c'est ce qui permet de
reprendre le minuteur en cours sur un autre appareil (§6.2 du cahier des charges).

### `friendships` (Mode Amis, LOT F1)

| Opération | Règle |
|---|---|
| SELECT | `auth.uid() in (requester_id, addressee_id)` — chacun voit ses propres relations. |
| INSERT / UPDATE / DELETE | **Aucune politique.** Toute mutation passe par une fonction `SECURITY DEFINER` (`send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `remove_friend`, `block_user`, `unblock_user` — migration `0021_friendships.sql`) qui vérifie `auth.uid()` et applique les règles métier (quota de 20 demandes/jour, blocage, unicité) avant d'écrire. Un bug ou une manipulation du client ne peut donc jamais créer, modifier ou supprimer une ligne directement. |

Unicité de la paire quel que soit le sens : colonnes générées `user_low`/`user_high`
(`least`/`greatest` des deux id), uniques ensemble — sert aussi de cible `ON CONFLICT` pour
`block_user()`. `are_friends(a, b)` (fonction `security definer`, migration `0021`) est la
brique réutilisée par toute future politique ayant besoin de savoir si deux comptes sont
amis (statut en direct et classement — LOT F2) : elle renvoie toujours `false` si l'un des
deux comptes est banni, ce qui suffit à garantir qu'un compte banni « n'apparaît nulle
part » partout où elle sert de garde, sans le revérifier à chaque fois.

Les lectures à champs restreints (`list_friends()`, `list_friend_requests()`,
`find_profile_preview()` — migration `0022_friend_lookup.sql`) ne renvoient jamais un
compte banni, ni (pour `find_profile_preview()`) un compte qui a bloqué l'appelant — ce
dernier cas échoue avec le même message générique (« Compte introuvable ») que pour un
compte réellement inexistant, pour ne jamais laisser deviner qu'on a été bloqué.

### Avatars (Storage, bucket `avatars`, LOT F1)

| Opération | Règle |
|---|---|
| SELECT (API Storage authentifiée : `list()`/`get()`) | Limitée à son propre dossier (`(storage.foldername(name))[1] = auth.uid()::text`) — personne ne peut lister le contenu du dossier d'un autre, ni énumérer le bucket entier. |
| INSERT / UPDATE / DELETE | Même règle : uniquement dans son propre dossier (`{uid}/avatar.webp` ou `{uid}/avatar.jpg`). |
| Lecture publique (URL directe `/storage/v1/object/public/avatars/...`) | **Hors RLS** : le bucket est marqué `public = true` (migration `0024_avatars_storage.sql`), Supabase sert alors l'octet brut sans passer par `storage.objects` — c'est ce qui donne la « lecture publique » demandée, indépendamment de la politique SELECT ci-dessus qui ne gouverne que l'API Storage authentifiée (list/get). |

Taille maximale 100 Ko et types `image/webp`/`image/jpeg` uniquement, imposés au niveau du
bucket (`file_size_limit`, `allowed_mime_types`) — en plus de la réduction côté navigateur
à 256×256 visant ≤ 40 Ko avant l'envoi (`src/features/avatar/process-avatar.ts`), qui passe
systématiquement l'image par un `<canvas>` (supprime les métadonnées EXIF, jamais
préservées par `drawImage`+`toBlob`). `admin_remove_avatar(p_target_user_id)` (réservée à
`is_admin()`, journalisée) déréférence `profiles.avatar_url` **et** supprime le fichier du
bucket, pour une suppression complète plutôt qu'un lien cassé.

### `support_messages` (accès admin, et signalement d'utilisateur — LOT F1)

| Opération | Règle |
|---|---|
| SELECT | `is_admin()` — seul un admin peut relire les messages (migration `0017_support_messages_admin_access.sql`, ajoutée avec le panneau Admin). |
| UPDATE | `is_admin()` — réservé au changement de `status` (`pending` → `processed`) ; le texte du message n'est jamais modifié depuis le client. |
| INSERT | Voir plus haut (`0011_support_messages.sql`) : ouverte à tous, connecté ou invité. |
| DELETE | Aucune politique : pas de suppression depuis le client. |

Le signalement d'un compte (Mode Amis, §2) réutilise cette table plutôt qu'une nouvelle
(migration `0023_user_reports.sql` : colonnes `category` et `reported_user_id` en plus) :
`report_user(p_target_user_id, p_reason)` est `security definer`, remplit `email` depuis le
compte connecté (jamais saisi à la main comme pour le formulaire de contact invité), et
limite à 10 signalements par jour par compte pour éviter de noyer la file admin.

### `quotes` et `changelog` (contenu géré par le panneau Admin)

| Opération | Règle |
|---|---|
| SELECT | `active = true` pour tout le monde (connecté ou invité) **ou** `is_admin()` — un admin voit aussi les lignes désactivées/brouillon pour les gérer. |
| INSERT / UPDATE / DELETE | `is_admin()` exclusivement. |

Ces deux tables ne contiennent aucune donnée personnelle : c'est du contenu éditorial
(citations de l'accueil, entrées de nouveautés) que `src/features/home/quotes.ts` et
`src/features/settings/changelog.ts` lisent en base avec un repli sur leur tableau
statique existant (invité hors-ligne, base vide ou non encore peuplée) — jamais une
dépendance dure à la base.

### `admin_log`

| Opération | Règle |
|---|---|
| SELECT | `is_admin()` exclusivement. |
| INSERT | `is_admin()` **et** `admin_id = auth.uid()` — un admin ne peut journaliser que ses propres actions, jamais au nom d'un autre. |
| UPDATE / DELETE | Aucune politique : un journal d'audit ne se corrige ni ne s'efface depuis le client, même par un admin. |

Chaque mutation admin (citation créée/modifiée/désactivée/supprimée, nouveauté publiée,
message support marqué traité...) écrit une ligne ici (§12 : « Les modifications admin
sont journalisées — qui, quoi, quand »).

## Droits PostgreSQL (GRANT)

RLS filtre les **lignes** qu'une requête peut voir ou modifier ; les `GRANT` PostgreSQL
autorisent l'accès à la **table** elle-même, en amont de RLS. Les deux sont nécessaires :
un `GRANT` sans politique RLS donnerait accès à toutes les lignes, et une politique RLS
sans `GRANT` ne sert jamais (la requête est refusée avant que RLS ne s'applique). Ces
`GRANT` n'élargissent jamais ce que RLS autorise déjà par politique : ils lèvent seulement
le blocage au niveau table.

Supabase accorde habituellement ces `GRANT` lui-même quand une table est créée depuis son
tableau de bord. Ce projet gère son schéma à la main via `supabase/migrations/`, donc ils
doivent être écrits explicitement — ce qui n'avait pas été fait jusqu'à la migration
`0018_grants.sql` (cause du `permission denied for table...` / 42501 rencontré en
production, corrigé manuellement dans le SQL Editor puis répercuté dans cette migration).

| Table | `anon` | `authenticated` |
|---|---|---|
| `profiles` | — | SELECT, INSERT, UPDATE |
| `user_settings` | — | SELECT, INSERT, UPDATE, DELETE |
| `tasks` | — | SELECT, INSERT, UPDATE, DELETE |
| `focus_sessions` | — | SELECT, INSERT, UPDATE, DELETE |
| `timer_state` | — | SELECT, INSERT, UPDATE, DELETE |
| `notes` | — | SELECT, INSERT, UPDATE, DELETE |
| `support_messages` | INSERT | SELECT, INSERT, UPDATE |
| `quotes` | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `changelog` | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `admin_log` | — | SELECT, INSERT |
| `friendships` | — | SELECT (toute mutation passe par RPC) |
| `storage.objects` (bucket `avatars`) | lecture publique hors RLS (bucket `public = true`) | list/get/upload/update/delete limités à son propre dossier |

Un `ALTER DEFAULT PRIVILEGES` (toujours dans `0018_grants.sql`) fait que toute future table
ou fonction créée par le rôle `postgres` (donc depuis l'éditeur SQL Supabase) hérite
automatiquement de ces droits, même si une migration oublie son propre `GRANT`. Ça ne
dispense pas d'en écrire un explicitement : voir la règle de convention dans « Journal des
migrations » plus bas.

## Résolution de conflits (dernier horodatage gagne)

`user_settings` et `timer_state` n'ont **pas** de trigger `set_updated_at` : c'est le
client qui fournit `updated_at` à chaque écriture (l'heure de la modification locale,
pas l'heure d'arrivée sur le serveur). Un trigger `reject_stale_write` (migration
`0008_last_write_wins.sql`) ignore silencieusement une mise à jour dont `updated_at` est
antérieur à la valeur déjà en base : si l'appareil A était hors ligne et renvoie un
changement plus vieux qu'un changement déjà synchronisé depuis l'appareil B, celui de A
est abandonné sans écraser celui de B. C'est volontairement différent de `profiles` et
`tasks`, qui gardent un trigger `set_updated_at` classique (l'heure serveur suffit, il
n'y a pas de scénario de synchronisation multi-appareil concurrente documenté pour eux
dans cette phase).

`focus_sessions` n'a pas ce mécanisme : chaque session a un `id` unique généré côté
client à sa création, donc deux sessions ne s'écrasent jamais entre elles. La seule mise
à jour possible porte sur la même ligne (la finaliser), jamais sur celle d'un autre
appareil ou d'une autre session — c'est ce qui garantit qu'aucune session n'est perdue.

## Validation côté serveur

- Les contraintes `check` sur `kind`, `mode`, `segment`, `status`, `role`, `stats_visibility`
  empêchent l'insertion de valeurs hors énumération, même en cas de bug côté client.
- `planned_seconds >= 0` et `actual_seconds >= 0` sur `focus_sessions` : pas de durée de
  focus négative ou fantaisiste. Une validation plus poussée (durée réelle cohérente avec
  `started_at`/`ended_at`) est prévue pour une Edge Function de validation au moment
  d'implémenter la fin de session (hors périmètre de cette phase, qui pose le schéma).

## Authentification

- Mot de passe : vérifié côté client (`isValidPassword`) **et** par Supabase Auth
  côté serveur — la validation client est un confort d'UX, jamais la seule barrière.
- Connexion Google, deux mécanismes, voir `docs/GOOGLE_AUTH.md` :
  - OAuth redirigé (`signInWithOAuth`), géré entièrement par Supabase.
  - Google Identity Services (`signInWithIdToken`), actif seulement si
    `VITE_GOOGLE_CLIENT_ID` est configuré. Un nonce aléatoire généré côté client
    (`src/features/auth/google-identity.ts`) et son empreinte SHA-256 garantissent que
    le jeton d'identité Google reçu correspond bien à cette tentative de connexion
    précise (protection contre le rejeu d'un jeton intercepté ailleurs) ; Supabase
    vérifie cette correspondance avant de créer la session.
- Réinitialisation de mot de passe (`resetPasswordForEmail`) : le message affiché à
  l'utilisateur est **volontairement identique** que l'adresse e-mail corresponde à un
  compte existant ou non, pour ne jamais révéler si une adresse est inscrite.

### Suppression de compte

- `public.delete_own_account()` (migration `0013_delete_account.sql`) est `security
  definer` : un utilisateur authentifié n'a normalement pas le droit de supprimer une
  ligne de `auth.users` (schéma géré par Supabase), cette fonction le fait à sa place,
  avec les droits de son propriétaire.
- La cible est **exclusivement** `auth.uid()`, jamais un paramètre fourni par le client :
  il est structurellement impossible de supprimer le compte de quelqu'un d'autre, même en
  cas de bug côté interface (même principe que `ensure_profile()`).
- Toutes les tables de données utilisateur (`profiles`, `user_settings`, `tasks`,
  `focus_sessions`, `timer_state`, `notes`) ont une clé étrangère `on delete cascade` vers
  `auth.users` (directement, ou via `profiles` qui cascade elle-même) : une seule
  suppression suffit à tout effacer, sans fonction séparée par table.
- Côté interface, la confirmation exige de retaper son propre pseudo exactement (pas une
  simple case à cocher), pour limiter les suppressions accidentelles.

## Comment vérifier soi-même l'isolation entre utilisateurs

1. Crée deux comptes de test (A et B) dans Supabase Auth.
2. Avec le jeton de A, insère une ligne dans `tasks` (ou toute autre table).
3. Avec le jeton de B, tente un `select * from tasks` : la ligne de A ne doit **jamais**
   apparaître. Tente aussi un `update`/`delete` ciblant l'id de la ligne de A : la requête
   doit retourner 0 ligne affectée (jamais une erreur explicite qui confirmerait l'existence
   de la ligne — c'est le comportement normal et voulu de RLS).
4. Voir `src/shared/supabase/__tests__/rls.manual.md` pour un script pas-à-pas exécutable
   avec deux clients Supabase (deux utilisateurs), à lancer manuellement contre un vrai
   projet (RLS ne peut pas être vérifiée par un test unitaire sans base réelle).

## Notifications push (non implémentées)

Le Web Push (§6.2 du cahier des charges) introduira une table `push_subscriptions` et
une Edge Function tournant avec la clé `service_role` — seule exception documentée à la
règle « pas de `service_role` dans le front », puisque ce code tourne côté serveur, pas
dans le navigateur. Conception complète, RLS incluse, dans `docs/NOTIFICATIONS_PUSH.md`.

## Journal des migrations

Chaque fichier de `supabase/migrations/` est numéroté, idempotent (peut être recollé sans
erreur) et porte sur un seul sujet. À coller dans l'éditeur SQL Supabase, dans l'ordre
numérique, une seule fois par projet.

**Convention** : toute migration qui crée une table ou une fonction inclut ses propres
`GRANT` (table par table / fonction par fonction), comme `0003`, `0009`, `0012` et `0013`
le font déjà pour leurs fonctions, et comme `0018` le fait rétroactivement pour les tables
créées avant que cette règle ne soit explicite. Une table ou fonction sans son `GRANT`
propre, même couverte par `ALTER DEFAULT PRIVILEGES`, doit être considérée comme un oubli
à corriger.
