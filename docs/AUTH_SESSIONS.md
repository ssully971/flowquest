# Sessions d'authentification : « Invité » intempestif (LOT 2)

## Ce que fait l'application

`AuthProvider` ne repasse en **invité** que dans deux cas :

1. évènement `SIGNED_OUT` explicite de Supabase (déconnexion volontaire, autre onglet, ou jeton
   définitivement refusé par le serveur) ;
2. session introuvable **après vérification** (`getSession()` sans session et sans erreur passagère).

Une session momentanément nulle (échec de rafraîchissement du jeton sur réseau lent, onglet réveillé,
verrou d'auth) **ne déconnecte plus** : l'utilisateur et son profil sont conservés, une pastille
« Reconnexion… » s'affiche discrètement et la vérification est retentée (2 s, 5 s, 15 s, puis 30 s, et
immédiatement au retour du réseau ou de l'onglet). Les appels Supabase déclenchés par un changement
d'état d'authentification (chargement du profil) sont différés hors du callback `onAuthStateChange`.

Le profil est chargé avec un délai de 8 s et jusqu'à 3 tentatives (échecs passagers seulement), et le
dernier profil connu (par utilisateur) est mis en cache dans `localStorage` (`flowquest.profileCache.<id>`) :
pseudo et avatar s'affichent aussitôt. Le cache est effacé à la déconnexion et à la suppression du compte.

## Réglages du tableau de bord Supabase à vérifier

Un `SIGNED_OUT` réel peut venir du serveur ; ces réglages produisent exactement le symptôme « je me
connecte sur un second appareil et je deviens Invité sur le premier » :

Authentication → **Sessions** (selon le plan) :

- **Enforce single session per user** : doit être **désactivé**. Activé, une connexion sur un second
  appareil **révoque** la session du premier, qui reçoit `SIGNED_OUT` : c'est une vraie déconnexion, que
  l'application ne peut (et ne doit) pas masquer.
- **Time-box user sessions** : durée maximale d'une session (déconnexion forcée après X). À laisser vide
  ou très longue.
- **Inactivity timeout** : déconnexion après X d'inactivité. À laisser vide ou longue (au moins plusieurs
  jours pour une application de focus qu'on rouvre de temps en temps).

Authentication → **Settings** (ou « Sessions » / « JWT ») :

- **Detect and revoke potentially compromised refresh tokens** (détection de réutilisation) : si deux
  appareils ou onglets utilisent le même jeton de rafraîchissement hors de l'intervalle ci-dessous, toute
  la famille de jetons est révoquée → `SIGNED_OUT` sur tous.
- **Refresh token reuse interval** (10 s par défaut) : délai pendant lequel un même jeton peut être
  réutilisé sans déclencher la révocation. Sur réseau lent ou avec plusieurs onglets, **l'augmenter**
  (30 à 60 s) réduit les révocations injustifiées.
- **JWT expiry** (3600 s par défaut) : ne pas descendre sous quelques minutes (chaque expiration impose
  un rafraîchissement, donc une occasion d'échec réseau).

Vérification rapide : se connecter sur l'appareil A, puis sur l'appareil B avec le même compte. Si A passe
en « Invité » aussitôt, c'est **Enforce single session per user** (ou la détection de réutilisation). Si
A reste connecté mais affiche « Reconnexion… » un instant, c'est le comportement attendu sur réseau lent.
