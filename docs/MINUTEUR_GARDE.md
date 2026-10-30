# Terminer une session et garde anti-oubli de 4 h

## Terminer (tous les modes)

Le bouton **Terminer** existe en Pomodoro, Minuteur et Chrono. Chrono et Minuteur s'enregistrent comme du
**focus** (`kind = focus`, comme dans les salons). Sous 60 s de focus, terminer à la main n'enregistre rien en
Chrono/Minuteur (`MIN_RECORDED_SECONDS`) et demande confirmation d'abord ; le Pomodoro garde son comportement
historique. Le bilan affiche : temps de focus réel, temps de pause (pauses manuelles + absence), pauses manuelles,
tâches cochées, XP de pilier. `focus_sessions.paused_seconds` / `pause_count` (migration 0052) conservent ces
totaux ; un déclencheur plafonne `actual_seconds` à la durée réelle de la session et à 24 h.

## Garde anti-oubli (« Tu es toujours là ? »)

- **Chrono / Minuteur** (`timer-engine.ts`, `applyGuard`) : à chaque tranche de 4 h de focus effectif, le temps est
  figé à l'instant EXACT du franchissement (équivalent d'une pause posée à ce moment, même après un onglet suspendu
  ou fermé : `settle` reconstitue l'état). « Je suis là » (`confirmPresence`) relance : l'absence compte comme
  temps de pause et le prochain contrôle est dans 4 h de focus. Sans réponse puis « Terminer » : seules les heures
  confirmées sont enregistrées. Un Minuteur de moins de 4 h n'est jamais concerné.
- **Pomodoro** (`presence-guard.ts`) : le focus cumulé voyage de phase en phase (`guardCarryMs`). À 4 h, le focus
  suivant ne démarre PAS tout seul : à la fin de la pause en cours, la même fenêtre attend « Je suis là », qui
  réarme le compteur et relance la session.
- **Alerte** : son dédié `public/sounds/alerts/alerte-4h.mp3` (volume et réglage de son existants, amorçage audio
  sur geste pour le mobile), notification système si l'onglet est masqué, repli visuel (titre de l'onglet + texte
  dans la fenêtre) si le son est bloqué.
- **Annonce** : petite carte non bloquante au lancement d'une session et après chaque confirmation ; masquable dans
  Réglages > Minuteur (le contrôle, lui, reste actif).
- **Limites connues** : la garde des sessions de GROUPE n'est pas implémentée (voir le compte rendu : il faut une
  confirmation par participant côté serveur) ; l'état de garde (`guardLimitMs`…) n'est pas synchronisé entre
  appareils (la table `timer_state` n'a pas ces colonnes) — un état repris depuis un autre appareil repart avec la
  limite par défaut de 4 h.
