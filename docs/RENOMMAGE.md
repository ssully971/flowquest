# Renommage Flowquest → Fokitsu — phase 1

Le produit s'appelle désormais **Fokitsu**. Cette phase 1 ne touche que les textes, les
métadonnées et les assets de marque. Les couleurs du thème, le domaine, la configuration de
déploiement (Vercel) et les URLs du dépôt GitHub ne changent pas.

## Ce qui a été renommé

- `APP_NAME` (`src/shared/app-config.ts`) : source de vérité du nom affiché.
- Textes visibles, commentaires, logs console (`[Fokitsu]`), e-mails Supabase
  (`supabase/email-templates/*.html`), documentation, README, `.env.example`.
- Identifiants internes sans risque : `FokitsuDB`, `package.json`/`package-lock.json`,
  identifiant de motif SVG des fonds.
- Nom du fichier de sauvegarde exportée : `fokitsu-sauvegarde-DATE.json`.

## Identifiants techniques volontairement conservés

Ils persistent chez les utilisateurs ou dans l'historique : les renommer sans migration ferait
perdre des données. Un test (`src/test/identifiants-historiques.test.ts`) les verrouille.

| Identifiant | Où | Pourquoi |
|---|---|---|
| Base IndexedDB `flowquest` | `src/shared/storage/db.ts` (`DB_NAME`), `src/features/diagnostic/clear-local-storage.ts` (`INDEXED_DB_NAME`) | Contient tâches, notes, sessions, réglages hors ligne. Une base renommée apparaîtrait vide. Les deux constantes doivent rester identiques. |
| Clés `flowquest.*` de localStorage / sessionStorage (19) | thème, fonds, réglages, mode, bannières, etc. | Les renommer réinitialiserait les préférences de chaque utilisateur. |
| Marqueur de sauvegarde `flowquest` | `src/features/backup/local-backup.ts` | L'**import** accepte `flowquest` et `fokitsu` ; l'**export** garde `flowquest` pour rester lisible par les versions déjà installées. |
| Mot réservé de pseudo `flowquest` | `src/features/auth/validation.ts` | `fokitsu` y a été ajouté en plus. |
| Migrations et tests SQL | `supabase/migrations/**`, `supabase/tests/**` | Historique immuable (ex. réglage `flowquest.invite_internal`, tâche cron `flowquest_purge_pending_invites` de la 0047). |
| Adresse `flowquestt@gmail.com`, domaine `flowquestt.vercel.app` | pages légales, docs | Boîte et domaine réels : à migrer hors dépôt (phase ultérieure). |
| Comptes de test `*@test.flowquest.dev`, `admin@flowquest.app` | `rls.manual.md`, un test | Données de test, sans effet sur l'app. |

## Assets de marque

- Logotypes `public/brand/logo-wordmark-{white,black,color}.webp` : nouveaux logotypes « Fokitsu ».
- `public/brand/logo-icon.webp` (variante `mark` du composant `Logo`) : tête de renard.
- Favicon (`favicon.ico`, `favicon-16.png`, `favicon-32.png`) et icônes PWA/iOS
  (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-icon-512.png`) générés
  depuis la tête de renard. L'ancien `favicon.svg` et `logo-vertical.webp` sont supprimés.
- Sources conservées hors bundle dans `design/` (logotypes, tête, logo horizontal, mascotte). La
  mascotte (renard entier) et le logo horizontal ne sont **pas** utilisés dans l'app.

## Proposition pour une phase ultérieure : migrer les identifiants

Sans l'implémenter ici :

1. **IndexedDB** : au démarrage, si `fokitsu` n'existe pas et `flowquest` existe, ouvrir
   l'ancienne base, copier chaque object store vers la nouvelle (`fokitsu`, même schéma),
   vérifier les comptes, puis ne supprimer l'ancienne qu'après une version ou deux de
   cohabitation. Mettre à jour `DB_NAME` et `INDEXED_DB_NAME` ensemble.
2. **localStorage** : un module de migration lit chaque clé `flowquest.X`, écrit `fokitsu.X`
   si absente, puis supprime l'ancienne ; les modules lisent la nouvelle clé avec repli sur
   l'ancienne pendant la transition.
3. **Sauvegardes** : exporter avec `fokitsu` une fois la migration déployée (l'import
   accepte déjà les deux).
4. **Domaine, e-mail de contact, nom de projet Supabase** : à traiter avec le domaine.

## Choix notables

- Le logotype « bleu nuit » (`logo-wordmark-color.webp`) n'offre que ≈ 1,7:1 de contraste sur
  le panneau Réglages sombre (≈ 10:1 sur le clair). `Logo` en `tone="panel"` affiche donc la
  version blanche en sombre et la version bleu nuit en clair (l'ancien dégradé clair n'existe
  plus).
- Icônes PWA/iOS sur fond uni `#0C0719` (thème sombre, couleur déjà présente) : les parties
  crème de la tête (oreilles, joues, bout de queue) y contrastent à ≈ 19:1 ; sur `#F1EAFF`
  elles tomberaient à ≈ 1,1:1. La version maskable garde la tête dans ≈ 60 % central.
- Le titre d'écran de connexion n'est plus mis en minuscules (l'ancien logotype l'était).
- Tagline du manifest (« La quête du flow… ») inchangée : à revoir avec la suite de l'identité.

## Actions manuelles hors dépôt

- **Supabase** : nom du projet, nom de l'expéditeur des e-mails, gabarits à recoller
  (Authentication > Email Templates, depuis `supabase/email-templates/*.html`). Site URL inchangée.
- **Google Cloud** : nom de l'application sur l'écran de consentement OAuth.
- **PWA** : les écrans d'accueil iOS/Android déjà installés gardent l'ancien nom et l'ancienne
  icône jusqu'à désinstallation puis réinstallation.
- **E-mail de contact** : `flowquestt@gmail.com` reste affiché dans les pages légales.
