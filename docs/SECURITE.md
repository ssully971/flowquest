# Sécurité — Flowquest

Référence des politiques RLS (Row Level Security) et des règles de sécurité appliquées
côté base de données Supabase. Toute vérification d'accès vit ici, jamais seulement
côté interface : même un bug ou une manipulation du client ne doit jamais permettre à
un utilisateur de lire ou modifier les données d'un autre.

## Principes

- RLS **activée sur toutes les tables** dès leur création (`alter table ... enable row level security`).
- Aucune politique « permissive par défaut » : sans politique explicite, Postgres refuse
  tout accès. Chaque table liste donc ses politiques une par une ci-dessous.
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

Pas de lecture inter-utilisateurs pour l'instant : les fonctionnalités sociales (amis,
classement, §10 du cahier des charges) sont hors périmètre de cette phase. Quand elles
arriveront, une politique SELECT plus large (ou une vue limitée à `username`/`avatar_url`)
sera ajoutée explicitement, jamais en assouplissant celle-ci par erreur.

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
  et sert de brique pour toute future politique réservée aux admins (contenu, modération...).
- Côté interface, `/admin` (`src/features/admin/AdminGate.tsx`) est protégée en lisant
  `profile.role` (chargé via `profiles_select_own`, donc fiable : cette politique ne
  renvoie jamais que la ligne du compte connecté lui-même). **Cette garde est un confort
  de navigation, pas une barrière de sécurité** — la vraie barrière, pour toute future
  table de contenu réservée aux admins, est RLS + `is_admin()` côté base.

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
