# Mode Amis — Flowquest

Document de référence du Mode Amis (profil social, amis, statut en direct, classement,
salons de focus, série partagée — V2 du cahier des charges, §10). Mis à jour à chaque lot
(F1 à F4). Pour le détail politique par politique, voir `docs/SECURITE.md` (source de
vérité pour les RLS) ; ce document se concentre sur le modèle de données et les règles
produit/vie privée.

## Statut

| Lot | Contenu | État |
|---|---|---|
| F1 | Profil, photo, amis, vie privée | ✅ Livré |
| F2 | Statut en direct, encouragements, classement | À venir |
| F3 | Salons de focus ensemble | À venir |
| F4 | Série partagée, finitions | À venir |

## Modèle de données (F1)

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

### Comptes bannis

Un compte banni (`profiles.banned_at` non nul, vérifié par `is_banned()`) :

- n'apparaît dans **aucune** liste (amis, demandes, aperçu de recherche, classement à
  venir) ;
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
  toute l'app, tailles `xs` à `xl`, point de statut optionnel (branché en LOT F2).
- `are_friends(a, b)` (SQL) : brique centrale réutilisée par toute future politique RLS ou
  fonction ayant besoin de savoir si deux comptes sont amis (et ni l'un ni l'autre banni) —
  statut en direct et classement (F2), invitation en salon (F3), série partagée (F4).

## Pas encore couvert (prévu dans les lots suivants)

- Statut en direct, encouragements, classement (F2).
- Salons de focus synchronisés (F3).
- Série partagée à deux (F4).
- Interface admin dédiée pour bannir/débannir un compte.
- Realtime (Supabase Realtime) : F1 recharge explicitement après chaque action, sans
  abonnement — introduit en F2 pour le statut en direct.
