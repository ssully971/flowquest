# Connexion Google — Flowquest

Par défaut (OAuth redirigé via Supabase), la fenêtre de consentement Google affiche
l'URL technique du projet Supabase (`xxxx.supabase.co`) plutôt que le nom et le
domaine de Flowquest. Ce document explique la solution gratuite pour corriger ça :
**Google Identity Services (GIS)**, qui envoie directement un jeton d'identité au
navigateur (`supabase.auth.signInWithIdToken`), sans passer par une redirection vers
Google puis retour. Rien de tout ça ne change le fonctionnement si tu ne configures
rien : Flowquest retombe alors automatiquement sur l'OAuth redirigé déjà en place.

## 1. Pourquoi deux mécanismes coexistent

- **Google Identity Services (nouveau, prioritaire)** : bouton natif Google, rendu
  directement dans la page. Au clic, Google affiche une fenêtre qui montre le nom et
  le domaine configurés dans ton propre projet Google Cloud — jamais l'URL Supabase.
  Actif uniquement si `VITE_GOOGLE_CLIENT_ID` est renseigné.
- **OAuth redirigé (existant, filet de sécurité)** : utilisé automatiquement si
  `VITE_GOOGLE_CLIENT_ID` est absent, ou si le script Google Identity Services ne
  charge pas (réseau, bloqueur de script, etc.).

## 2. Côté Google Cloud Console

1. Va sur [console.cloud.google.com](https://console.cloud.google.com), crée un
   projet (ou réutilise celui éventuellement déjà créé pour l'OAuth Supabase
   existant).
2. **Écran de consentement OAuth** (APIs & Services > OAuth consent screen) :
   - Nom de l'application : `Flowquest`.
   - Logo de l'application : le logo Flowquest (`public/brand/logo-icon.png`), pour
     qu'il apparaisse dans la fenêtre de consentement.
   - Domaine de l'application / domaines autorisés : `flowquestt.vercel.app` (et ton
     domaine personnalisé si tu en configures un plus tard).
3. **Identifiants** (APIs & Services > Credentials) > Create Credentials > OAuth
   client ID > type **Web application** :
   - Nom : `Flowquest — Google Identity Services`.
   - **Authorized JavaScript origins** : ajoute `https://flowquestt.vercel.app` et, si
     tu testes en local, `http://localhost:5173` (port Vite par défaut).
   - Pas besoin d'« Authorized redirect URIs » pour ce client-ci : GIS ne redirige
     pas, il renvoie un jeton directement dans la page.
   - Récupère le **Client ID** généré (se termine par `.apps.googleusercontent.com`).

> Le client OAuth existant utilisé par l'OAuth redirigé (configuré côté Supabase,
> Authentication > Providers > Google) reste nécessaire et inchangé : c'est le filet
> de sécurité. Le nouveau Client ID ci-dessus est spécifique à Google Identity
> Services.

## 3. Côté Flowquest

Ajoute dans ton `.env` (jamais commité) :

```
VITE_GOOGLE_CLIENT_ID=XXXXXXXXXXXX.apps.googleusercontent.com
```

Puis redéploie (ou relance le serveur de dev). Sans cette variable, Flowquest
continue de fonctionner exactement comme avant (bouton Google classique, OAuth
redirigé via Supabase) — aucune régression si tu ne configures rien.

## 4. Côté Supabase (déjà en place, à vérifier une fois)

Authentication > Providers > Google doit déjà avoir le provider Google activé (pour
l'OAuth redirigé). Pour que `signInWithIdToken` fonctionne aussi, le même **Client
ID** Google (celui utilisé côté GIS, étape 2) doit être autorisé côté Supabase :
Authentication > Providers > Google > « Authorized Client IDs » (ou champ
équivalent selon la version du dashboard) — ajoute le Client ID de l'étape 2 à cette
liste, en plus de celui déjà utilisé pour l'OAuth redirigé.

## 5. Ce que fait le code

- `src/features/auth/google-identity.ts` : charge le script Google
  (`accounts.google.com/gsi/client`), génère un nonce aléatoire et son empreinte
  SHA-256 (exigés par Supabase pour vérifier que le jeton correspond bien à cette
  tentative de connexion).
- `src/features/auth/components/GoogleSignInButton.tsx` : affiche le bouton natif
  Google si `VITE_GOOGLE_CLIENT_ID` est configuré et que le script a chargé ; sinon,
  affiche automatiquement le bouton de repli (OAuth redirigé).
- `AuthProvider.signInWithGoogleIdToken` : appelle
  `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })`.

## 6. Limite connue

Google Identity Services peut être bloqué par certains bloqueurs de publicité ou de
traqueurs tiers (le script vient de `accounts.google.com`). Dans ce cas, le bouton de
repli (OAuth redirigé) s'affiche automatiquement après l'échec de chargement — aucune
action utilisateur requise, juste une fenêtre de consentement qui montre à nouveau
l'URL Supabase dans ce cas précis.
