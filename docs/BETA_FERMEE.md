# Bêta fermée — Fokitsu

Depuis `0047_invite_codes.sql`, créer un compte exige un **code d'invitation à usage
unique**. Les comptes existants ne sont pas concernés (`profiles.invite_ok = true`).

## Qui génère des codes

| Source | Conditions | Validité |
|---|---|---|
| Admin (Admin > Codes d'accès) | être admin | 12 h |
| Utilisateur (Profil > Inviter un ami) | compte ≥ 7 jours, ≥ 10 h de focus réel, < 2 codes ce mois-ci (mois calendaire, fuseau `America/Guadeloupe`) | 7 jours |

Tous les seuils vivent dans la fonction SQL `invite_setting()` (un seul endroit). Pour les
changer : `create or replace function public.invite_setting ...` avec la nouvelle valeur.

## Comment l'inscription est protégée

Choix : **trigger sur `auth.users`** (via `handle_new_user()`), plutôt qu'Edge Function ou
Auth Hook.

- Le code est validé **et** consommé dans la même transaction que l'insertion du compte :
  si la création échoue, le code n'est pas brûlé ; deux inscriptions simultanées avec le
  même code → une seule réussit (verrou de ligne sur l'`UPDATE` conditionnel).
- Il n'y a rien à héberger ni à configurer (pas d'Edge Function, pas de service role, pas
  d'Auth Hook), et le signUp public de Supabase peut rester activé : la base est la garde.
- Une Edge Function obligerait à désactiver le signUp public et à dupliquer la logique
  d'Auth (confirmation e-mail, OAuth) ; un Auth Hook n'offre pas la garantie « même
  transaction ».

**E-mail** : le formulaire envoie `options.data.invite_code`. Sans code valide, Supabase
renvoie « Database error saving new user », que l'interface affiche comme « Code invalide
ou expiré » (jamais la raison réelle).

**Google** : impossible de saisir un code avant l'OAuth. Le compte est donc créé *en
attente* (`invite_ok = false`) : l'interface affiche l'écran « Entre ton code d'invitation »,
et côté serveur `is_banned()` bloque les fonctions sociales. `consume_invite_code()` active
le compte. Les comptes en attente depuis plus de 24 h sont supprimés par
`purge_pending_invite_accounts()` (planifiée toutes les heures si `pg_cron` est activé).
Les comptes Google existants se connectent normalement.

## Interrupteur

Drapeau `beta_fermee` (Admin > Fonctionnalités), activé par défaut. Coupé : plus de code
exigé (inscription e-mail libre, comptes Google actifs d'emblée). Le drapeau `signups`
(« Inscriptions ouvertes ») reste prioritaire : s'il est coupé, personne ne peut s'inscrire.

## Limites connues

- Un code est consommé à la création du compte, même si l'e-mail n'est jamais confirmé.
- Créer un utilisateur à la main depuis le tableau de bord Supabase (Authentication > Add
  user) est refusé tant que `beta_fermee` est actif : coupe-le le temps de l'opération.
- Les données d'un compte Google en attente (avant activation) restent accessibles à ce
  compte via RLS ; seules les fonctions sociales sont bloquées, d'où la purge à 24 h.

## Tester

- SQL : `supabase/tests/invite_codes.sql` (éditeur SQL Supabase, tout est annulé à la fin).
- Manuel : voir la liste de contrôle donnée avec chaque lot.
