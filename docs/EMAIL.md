# E-mail — Flowquest

Le service d'envoi d'e-mail par défaut de Supabase (confirmation d'inscription,
réinitialisation de mot de passe) est très limité en volume et en fiabilité de
livraison (délais, spam) : il est fait pour des tests, pas pour un vrai site. Ce
document explique comment le remplacer par **Brevo** (ex-Sendinblue), dont l'offre
gratuite (300 e-mails/jour) suffit largement pour Flowquest, et quelles étapes manuelles
tu dois faire — rien de tout ça ne se configure depuis le code.

## 1. Côté Brevo

1. Crée un compte sur [brevo.com](https://www.brevo.com) (gratuit).
2. **Valide une adresse expéditeur**, pas un domaine (SMTP & API > Senders, Domains &
   Dedicated IPs > onglet **Senders**) : ajoute l'adresse que tu veux utiliser pour
   l'envoi (ex. `bonjour@flowquestt.vercel.app`, ou n'importe quelle adresse que tu
   contrôles), Brevo t'envoie un code de validation à cette adresse, tu le colles dans
   Brevo. **Tu ne peux pas valider `flowquestt.vercel.app` comme domaine** (onglet
   **Domains**) : cette méthode exige d'ajouter des enregistrements DNS (SPF, DKIM) chez
   l'hébergeur du domaine, et `vercel.app` appartient à Vercel — tu n'as pas la main sur
   son DNS. La validation par adresse expéditeur ne demande, elle, aucun accès DNS.
3. Récupère une **clé SMTP** (SMTP & API > SMTP), pas une clé API REST — Supabase a
   besoin des identifiants SMTP classiques (hôte, port, utilisateur, mot de passe).

**Limite de cette méthode** : sans domaine validé (SPF/DKIM), une partie des e-mails
envoyés peut arriver en spam selon le fournisseur du destinataire (Gmail, Outlook...),
même avec une adresse expéditeur valide — Brevo authentifie l'expéditeur, mais pas le
domaine d'envoi. C'est un compromis acceptable pour démarrer, pas un problème à essayer
de corriger côté code : la solution durable est d'acheter un domaine personnalisé que tu
contrôles (chez n'importe quel registrar), de le valider comme domaine Brevo (étape 1.2
version domaine, avec les enregistrements DNS cette fois), et éventuellement de
l'utiliser aussi comme domaine du site à la place de `flowquestt.vercel.app`.

## 2. Côté Supabase

Dashboard du projet > **Authentication > Emails > SMTP Settings** (le libellé exact peut
varier légèrement selon la version de l'interface) :

| Champ | Valeur |
|---|---|
| Enable Custom SMTP | activé |
| Sender email | l'adresse validée dans Brevo (Senders) à l'étape 1 (ex. `bonjour@flowquestt.vercel.app`) |
| Sender name | `Flowquest` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | ton identifiant Brevo (visible sur la page SMTP) |
| Password | la clé SMTP générée à l'étape 1 |

Enregistre, puis envoie-toi un e-mail de test depuis cette même page si Supabase propose
l'option (sinon, teste directement via une inscription).

## 3. Modèles d'e-mail (recommandé)

`supabase/email-templates/` contient 4 modèles HTML prêts à coller, en français, aux
couleurs de Flowquest (carte blanche arrondie sur fond `#F2EAFF`, mot « flowquest » en
`#5A1FD1`, bouton pilule) : compatibles clients mail (tableaux, styles en ligne, pas de
CSS externe).

**Authentication > Emails > Templates**, un modèle à la fois : ouvre le fichier
correspondant, copie tout son contenu HTML, colle-le dans le champ « Message body » du
bon modèle Supabase, choisis un sujet en français (ex. « Confirme ton inscription sur
flowquest »), enregistre.

| Fichier | Modèle Supabase |
|---|---|
| `confirm-signup.html` | Confirm signup |
| `reset-password.html` | Reset Password |
| `change-email.html` | Change Email Address |
| `magic-link.html` | Magic Link |

Chaque modèle garde la variable `{{ .ConfirmationURL }}` (le lien d'action) telle quelle
— ne la traduis pas, ne la renomme pas. `change-email.html` utilise aussi
`{{ .NewEmail }}` (la nouvelle adresse demandée), propre à ce modèle.

## 4. Pourquoi ça ne se règle pas dans le code

`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (le seul réglage e-mail-adjacent côté
front) ne contrôlent que *quel projet Supabase* l'app utilise — jamais comment ce
projet envoie ses e-mails. Le SMTP est un réglage du projet Supabase lui-même, donc
exclusivement dans son dashboard. Il n'y a pas de clé SMTP à ajouter en variable
d'environnement côté Flowquest.

## 5. Ce que l'interface fait déjà, de son côté

- Toutes les redirections après e-mail (confirmation d'inscription, renvoi, connexion
  Google, réinitialisation de mot de passe) sont construites explicitement côté client
  avec `window.location.origin` — jamais laissées au seul réglage « Site URL » du
  dashboard Supabase — pour toujours ramener sur le site réellement utilisé au moment de
  la demande, même en cas de déploiement sur un domaine différent.
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

Si les e-mails ne partent toujours pas après avoir suivi ce document, vérifie d'abord que
l'adresse expéditeur est bien **validée** dans Brevo (Senders) — c'est la cause la plus
fréquente avec cette méthode. S'ils partent mais atterrissent systématiquement en spam,
voir la limite expliquée à l'étape 1 (pas de domaine validé) : c'est attendu avec cette
méthode, pas un bug à corriger.
