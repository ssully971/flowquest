# Constellation (lot 6B)

Vue graphe façon Obsidian de la progression : les **tâches** sont des nœuds, les **piliers** des
centres. Remplace l'ancienne « Galaxie » (spirale de sessions).

## Données
- `focus_sessions.task_id` : désormais renseigné (la tâche active à la fin d'un segment de focus).
  Le temps passé sur une tâche = somme des `actual_seconds` de ses sessions ; celui des
  sous-tâches remonte sur le parent. Les sessions antérieures au lot n'ont pas de tâche.
- `task_links` (migration 0058) : `depends_on` (orienté) ou `related` (symétrique, canonique
  `from < to`). RLS « propres lignes », trigger de garde (tâches à soi, pas de lien sur soi).
- `constellation_layouts` (0058) : une ligne par utilisateur, `positions` en jsonb.
- Garde-fou SQL : un `task_id` inconnu du serveur est remis à `NULL` (une session n'est jamais
  refusée parce que sa tâche n'est pas encore synchronisée).
- Invité : tout en IndexedDB (`taskLinks`, `constellationLayout`, base v8). Connecté : mêmes
  données, synchronisées par la file `offline-queue` ; tirage à la connexion (`useConstellationSync`).

## Code (`src/features/constellation`)
- `build-graph.ts` : graphe pur (filtres pilier/période/archivées, rayon et luminosité selon le
  temps, « allumé » si terminée, regroupement au-delà de 150 tâches : un nœud « +N » par pilier,
  les tâches liées ne sont jamais regroupées).
- `force-layout.ts` : d3-force, graine déterministe par nœud, positions de départ irrégulières ;
  un calcul à la fois, jamais en continu au repos ; nœuds déjà placés figés pendant l'intégration
  des nouveaux ; un nœud déplacé à la main est épinglé (double-clic = relâcher).
- `ConstellationCanvas.tsx` : zoom molette/pincement, pan, glisser des nœuds, tracé de liens,
  **verrou** (verrouillé : aucun geste ne bouge la vue ni les nœuds, les taps sélectionnent encore).
- `ConstellationPage.tsx` : page plein écran (portail dans `<body>`), filtres, indicateurs,
  détail d'un nœud, mode « relier » (glisser, ou deux touches), suppression de lien avec annulation.
- `ConstellationBackground.tsx` : fond d'écran `constellation` (registre des fonds) en lecture
  seule, une seule image dessinée, sans étiquettes ; constellation décorative si aucune tâche.

## Niveau de pilier
`pillar-tiers.ts` : le palier du pilier (Novice → Légende) fixe la taille, le halo et le nombre de
branches de son étoile.

## Accès
Verrouillée pour les invités (`LockableFeature = 'constellation'`) quand les comptes existent.
