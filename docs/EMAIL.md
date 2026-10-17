# E-mail — Flowquest

Le service d'envoi d'e-mail par défaut de Supabase (confirmation d'inscription,
réinitialisation de mot de passe) est très limité en volume et en fiabilité de
livraison (délais, spam) : il est fait pour des tests, pas pour un vrai site. Ce
document explique comment le remplacer par **Brevo** (ex-Sendinblue), dont l'offre
gratuite (300 e-mails/jour) suffit largement pour Flowquest, et quelles étapes manuelles
tu dois faire — rien de tout ça ne se configure depuis le code.

## 1. Côté Brevo

1. Crée un compte sur [brevo.com](https://www.brevo.com) (gratuit).
2. **Valide le domaine d'envoi** (SMTP & API > Senders, Domains & Dedicated IPs) : ajoute
   `flowquestt.vercel.app` (ou ton domaine personnalisé si tu en configures un plus
   tard), puis ajoute les enregistrements DNS que Brevo te donne (SPF, DKIM) chez ton
   hébergeur DNS. Sans ça, les e-mails partent mais atterrissent en spam partout.
3. Récupère une **clé SMTP** (SMTP & API > SMTP), pas une clé API REST — Supabase a
   besoin des identifiants SMTP classiques (hôte, port, utilisateur, mot de passe).

## 2. Côté Supabase

Dashboard du projet > **Authentication > Emails > SMTP Settings** (le libellé exact peut
varier légèrement selon la version de l'interface) :

| Champ | Valeur |
|---|---|
| Enable Custom SMTP | activé |
| Sender email | une adresse sur le domaine validé à l'étape 1 (ex. `bonjour@flowquestt.vercel.app`) |
| Sender name | `Flowquest` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | ton identifiant Brevo (visible sur la page SMTP) |
| Password | la clé SMTP générée à l'étape 1 |

Enregistre, puis envoie-toi un e-mail de test depuis cette même page si Supabase propose
l'option (sinon, teste directement via une inscription).

## 3. Modèles d'e-mail (optionnel mais recommandé)

**Authentication > Emails > Templates** : Supabase a des modèles par défaut en anglais
pour « Confirm signup » et « Reset password ». Tu peux les traduire en français
directement là (sujet + corps HTML), sans toucher au code — ce sont des variables
`{{ .ConfirmationURL }}` à garder telles quelles dans le texte.

## 4. Pourquoi ça ne se règle pas dans le code

`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (le seul réglage e-mail-adjacent côté
front) ne contrôlent que *quel projet Supabase* l'app utilise — jamais comment ce
projet envoie ses e-mails. Le SMTP est un réglage du projet Supabase lui-même, donc
exclusivement dans son dashboard. Il n'y a pas de clé SMTP à ajouter en variable
d'environnement côté Flowquest.

## 5. Ce que l'interface fait déjà, de son côté

- Après inscription, l'écran explique qu'il faut vérifier ses spams et que ça peut
  prendre quelques minutes, avec un bouton « Renvoyer l'e-mail » (délai de 45 s entre
  deux renvois, pour éviter le spam de boîte mail).
- « Mot de passe oublié ? » (page Compte, onglet Connexion) envoie un lien de
  réinitialisation ; le message de confirmation est volontairement le même, que
  l'adresse corresponde à un compte ou non (ne révèle jamais si une adresse est
  inscrite).
- Le lien reçu ramène sur Flowquest en « mode récupération » (détecté via l'évènement
  `PASSWORD_RECOVERY` de Supabase) : la seule action possible est alors de choisir un
  nouveau mot de passe, pas d'accéder au compte normalement.

Si les e-mails ne partent toujours pas après avoir suivi ce document, vérifie d'abord
les enregistrements DNS (étape 1.2) avec l'outil de vérification de Brevo — c'est la
cause la plus fréquente.
