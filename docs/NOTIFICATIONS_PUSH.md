# Notifications Push — Flowquest (§6.2 du cahier des charges)

Document de conception, **non implémenté**. Décision prise avec Sullivan : cette brique
touche à des secrets réels (clés VAPID), à une fonction serveur déployée et à une
livraison qui ne peut pas être vérifiée par un test automatisé dans cet environnement —
elle se construit et se vérifie manuellement, en dehors d'une session Claude Code. Ce
document donne tout ce qu'il faut pour l'implémenter en une passe, sans redécouvrir
l'architecture.

## Pourquoi c'est nécessaire

Un navigateur ne peut pas jouer de son ni afficher de notification système une fois
l'onglet **fermé** (pas juste en arrière-plan). Le système déjà en place
(`src/features/timer/notifications.ts`) couvre l'onglet ouvert ou en arrière-plan : son
(Web Audio), `Notification` locale si la permission est accordée, et un clignotement du
titre de l'onglet sinon. Pour prévenir l'utilisateur d'une fin de session **onglet
fermé**, il faut du **Web Push** : une notification système envoyée par un serveur,
réveillée par le navigateur/OS même application fermée.

**Sur iOS (Safari), le Web Push exige que l'app soit installée à l'écran d'accueil**
(iOS 16.4+) — Safari ne permet pas les notifications push pour un simple onglet. C'est
pour cette raison que la popup d'installation (§6.2, déjà implémentée dans
`src/features/pwa/`) existe : sans elle, la quasi-totalité des utilisateurs iOS
n'auraient jamais ce rappel de fin de session.

## Vue d'ensemble de l'architecture

```
┌─────────────┐   1. S'abonne au push     ┌──────────────────────┐
│  Navigateur │ ─────────────────────────▶│ push_subscriptions   │
│ (PushManager)│   (endpoint + clés)       │ (table Supabase)     │
└─────────────┘                            └──────────────────────┘
       │                                              ▲
       │ 2. Lance une session : écrit                 │ 4. Lit les push dus
       │    notify_at dans timer_state                │    (service_role)
       ▼                                              │
┌─────────────┐                            ┌──────────────────────┐
│ timer_state │ ◀──────────────────────────│ Edge Function        │
│ (déjà existant,│  3. pg_cron appelle      │ send-due-pushes      │
│  + notify_at) │     toutes les minutes    │ (web-push + VAPID)   │
└─────────────┘                            └──────────────────────┘
                                                       │
                                                       │ 5. POST au endpoint
                                                       ▼
                                            ┌──────────────────────┐
                                            │ Service de push du    │
                                            │ navigateur (FCM/APNs/…)│
                                            └──────────────────────┘
                                                       │
                                                       ▼
                                            Notification système,
                                            app fermée ou non.
```

## 1. Schéma de données

### `push_subscriptions` (nouvelle table, migration `0012_push_subscriptions.sql`)

| Colonne | Type | Note |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid not null references auth.users on delete cascade` | |
| `endpoint` | `text not null unique` | URL fournie par `PushSubscription.endpoint`. |
| `p256dh` | `text not null` | Clé publique de chiffrement (`subscription.toJSON().keys.p256dh`). |
| `auth` | `text not null` | Secret d'authentification (`subscription.toJSON().keys.auth`). |
| `created_at` | `timestamptz not null default now()` | |

RLS, même schéma que les autres tables (`docs/SECURITE.md`) :
`auth.uid() = user_id` pour SELECT/INSERT/DELETE côté client (pas d'UPDATE : on
supprime et recrée un abonnement plutôt que de le modifier). Un deuxième appareil du
même utilisateur crée une deuxième ligne (`endpoint` diffère par appareil/navigateur) :
on notifie **tous** les abonnements actifs de l'utilisateur, pas un seul.

### `timer_state` (table existante, migration additive `0012` ou suivante)

Pas besoin d'une table `scheduled_pushes` séparée : `timer_state` n'a déjà qu'**une
seule ligne par utilisateur** (§6.2 — c'est ce qui permet la reprise multi-appareil), ce
qui correspond exactement à « une notification programmée par session en cours ».
Ajouter :

- `notify_at timestamptz` — l'heure de fin du segment en cours, calculée côté client au
  lancement/reprise (`started_at + durée restante`). `null` si pas de segment en cours
  ou si le push a déjà été envoyé.
- `notify_sent boolean not null default false` — pour que l'Edge Function marque la
  ligne traitée sans la supprimer (le client continue de lire `timer_state` pour l'état
  du minuteur lui-même).

Le client **efface `notify_at`** (le remet à `null`) dès que la session est mise en
pause, réinitialisée ou abandonnée (§6.2 : « Annulée si la session est mise en pause ou
abandonnée ») — c'est le même point du code qui écrit déjà l'état du minuteur dans
`timer_state` (`TimerController` / `storage/supabase-timer-state-repository.ts`), donc
une extension de la forme existante plutôt qu'un nouveau mécanisme.

## 2. Clés VAPID

Générées une fois, jamais régénérées après mise en prod (ça invaliderait tous les
abonnements existants) :

```bash
npx web-push generate-vapid-keys
```

- Clé **publique** : utilisée côté client (`PushManager.subscribe({ applicationServerKey })`).
  Peut être commitée (c'est une clé publique), mais on la sert plutôt via une variable
  d'environnement Vite (`VITE_VAPID_PUBLIC_KEY`) pour pouvoir la faire tourner sans
  redéployer le code si besoin.
- Clé **privée** : **jamais** côté client. Stockée en secret Supabase
  (`supabase secrets set VAPID_PRIVATE_KEY=...`), lue uniquement par l'Edge Function.

## 3. Client

### Abonnement

Nouveau module `src/features/push/usePushSubscription.ts` (pattern à suivre : même
forme que `src/shared/hooks/useWakeLock.ts` — détection de support, état, cleanup) :

1. Vérifie le support : `'serviceWorker' in navigator && 'PushManager' in window`.
2. Sur iOS, n'affiche l'option d'abonnement que si
   `src/features/pwa/platform.ts#isStandaloneDisplayMode()` est vrai (déjà écrit pour la
   popup d'installation — à réutiliser tel quel).
3. Au clic sur « Activer les notifications de fin de session » (emplacement proposé :
   Réglages > Extras, sous un nouveau `ToggleRow`, ou un item dédié si plus de réglages
   push arrivent) :
   - `requestNotificationPermission()` (déjà existant) ;
   - `const registration = await navigator.serviceWorker.ready` ;
   - `const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })` ;
   - insère la ligne dans `push_subscriptions` (upsert sur `endpoint`, pas sur
     `user_id` : plusieurs appareils).
4. Expose aussi une désactivation (`subscription.unsubscribe()` + suppression de la
   ligne `push_subscriptions`), pour respecter le RGPD (§15 du cahier des charges).

### Programmation de la notification

Dans `useFocusTimer.ts`, aux points où l'état est déjà écrit (`start`, `pause`, `reset`,
`skip`, fin de segment) : calculer/effacer `notify_at` en même temps que le reste de
l'état du minuteur, dans le même appel à `SyncingTimerStateRepository.save(...)`. Pas de
nouvel appel réseau séparé.

### Service Worker

**Changement de configuration nécessaire** : le projet utilise actuellement la stratégie
`generateSW` de `vite-plugin-pwa` (`vite.config.ts`), qui génère un service worker figé
(précache uniquement) et ne permet pas d'y ajouter un écouteur `push` personnalisé. Il
faudra passer à la stratégie **`injectManifest`** :

- `vite.config.ts` : `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', ... })`.
- Nouveau fichier `src/sw.ts` :
  ```ts
  import { precacheAndRoute } from 'workbox-precaching'
  precacheAndRoute(self.__WB_MANIFEST)

  self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {}
    event.waitUntil(
      self.registration.showNotification(data.title ?? 'Flowquest', {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      }),
    )
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(self.clients.openWindow('/'))
  })
  ```
- Vérifier après coup que `npm run build` précache toujours les mêmes fichiers
  qu'avant (le `globPatterns` de `vite.config.ts` reste valable avec `injectManifest`,
  seule la génération change).

## 4. Serveur : Edge Function `send-due-pushes`

Nouveau dossier `supabase/functions/send-due-pushes/index.ts`, appelé par `pg_cron`
toutes les minutes :

1. Se connecte à Supabase avec la clé `service_role` (jamais exposée côté client — seule
   exception documentée à la règle « pas de `service_role` dans le front », car ce code
   tourne côté serveur).
2. `select user_id, notify_at from timer_state where notify_at is not null and notify_at <= now() and notify_sent = false`.
3. Pour chaque ligne : `select endpoint, p256dh, auth from push_subscriptions where user_id = $1`.
4. Envoie via la librairie [`web-push`](https://www.npmjs.com/package/web-push) (import
   npm compatible Deno) à chaque abonnement, avec un payload JSON `{ title, body }`
   (texte à reprendre de `strings.focus.notifications.*`, dupliqué côté serveur puisque
   l'Edge Function n'a pas accès à `src/shared/i18n`).
5. Si l'envoi renvoie **410 Gone** ou **404** (abonnement expiré/révoqué) : supprime la
   ligne `push_subscriptions` correspondante (nettoyage, évite de retenter indéfiniment
   un endpoint mort).
6. Marque la ligne `timer_state.notify_sent = true` (jamais `delete`, pour ne pas perdre
   l'état du minuteur).

### Planification (pg_cron)

```sql
select cron.schedule(
  'send-due-pushes',
  '* * * * *',  -- chaque minute
  $$
  select net.http_post(
    url := '<URL_DE_LA_FONCTION>',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb
  );
  $$
);
```

Alternative plus simple si disponible sur le plan Supabase utilisé : les **Cron
Triggers** natifs de l'interface Supabase (Database > Cron), qui évitent d'écrire le SQL
`pg_cron` à la main.

## 5. Checklist de mise en œuvre (hors session Claude Code)

- [ ] Générer les clés VAPID, stocker la privée en secret Supabase, la publique en
      variable d'environnement Vite.
- [ ] Écrire et coller la migration `0012_push_subscriptions.sql` (table + RLS) et la
      migration ajoutant `notify_at`/`notify_sent` à `timer_state`.
- [ ] Passer `vite-plugin-pwa` en stratégie `injectManifest`, écrire `src/sw.ts`.
- [ ] Écrire `usePushSubscription.ts` + le contrôle dans Réglages (probablement Extras).
- [ ] Étendre `useFocusTimer.ts` pour écrire/effacer `notify_at` aux bons moments.
- [ ] Écrire et déployer l'Edge Function `send-due-pushes` (`supabase functions deploy`).
- [ ] Planifier l'appel toutes les minutes (`pg_cron` ou Cron Trigger natif).
- [ ] Vérifier manuellement (checklist à dérouler sur un vrai appareil, onglet/app
      **fermée**) :
  - [ ] Android/Chrome : la notification arrive après la durée du segment, app fermée.
  - [ ] iOS, app installée à l'écran d'accueil : idem.
  - [ ] iOS, app **non** installée : le contrôle d'abonnement est bien masqué/désactivé
        (pas de promesse qu'on ne peut pas tenir).
  - [ ] Mettre la session en pause avant la fin : aucune notification n'arrive.
  - [ ] Un abonnement révoqué (désinstallation, permission retirée) est bien nettoyé de
        `push_subscriptions` au prochain envoi raté, sans faire planter l'Edge Function
        pour les autres utilisateurs.

## 6. Ce qui reste hors périmètre même après cette implémentation

- Notifications de contenu autre que « fin de session » (défis, succès, amis — §10/§14
  du cahier des charges, V2+).
- Rate-limiting / retry applicatif en cas d'échec réseau de `send-due-pushes` elle-même :
  `pg_cron` la rappellera à la minute suivante, donc un échec isolé n'est pas bloquant,
  juste une notification en retard d'une minute.
