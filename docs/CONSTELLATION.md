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
  **verrou** (verrouillé : aucun geste ne bouge la vue ni les nœuds, les taps sélectionnent encore),
  recadrage doux (250 ms, coupé sous `prefers-reduced-motion`).
- `ConstellationPage.tsx` : page plein cadre (portail dans `<body>`) — voir « v2 » ci-dessous.
- `ConstellationBackground.tsx` : fond d'écran `constellation` (registre des fonds) en lecture
  seule, une seule image dessinée, sans étiquettes ; constellation décorative si aucune tâche.

## Constellation v2 « graphe sobre » (`docs/CONSTELLATION_V2.md`)
Refonte du dessin et de l'interface ; données, `build-graph.ts` et `force-layout.ts` inchangés.
- **Rendu** (`draw-constellation.ts`) : aucune lueur ni dégradé ; un seul accent (`--accent`) pour
  la sélection ; couleurs lues des jetons `--cst-*` (`tokens.css`, sombre et clair) ; tâche terminée =
  disque plein cerclé du fond, à faire = contour ; pilier = disque + anneau fin ; survol/sélection :
  `neighborhood.ts` met le voisinage en avant, le reste passe à 28 % ; étiquettes auto/toujours/jamais.
- **Interface plein cadre** : puces de piliers (légende + filtre, `display-filters.ts`), période
  30 j / 90 j / Tout, popover de réglages (`constellation-settings.ts`, mémorisés), pilule de zoom,
  mini-carte (`minimap.ts`), aide « Glisse un nœud » vue une seule fois.
- **Inspecteur** (`ConstellationInspector.tsx`, `inspector-data.ts`) : panneau à droite (≥ 1024 px) ou
  feuille en bas ; statut daté, encart « Débloquée / Bloquée par », temps et sessions, focus par
  semaine, liens cliquables, « Relier à une tâche », « Ouvrir la tâche » / « Marquer terminée »,
  « Lancer un focus » (`tasks/panel-requests.ts` : AppShell choisit la tâche et passe en Focus,
  FocusScreen prend le pilier et démarre le minuteur s'il est au repos).
- **Vue locale** (`local-subgraph.ts`) : sous-graphe par profondeur 1–3 (opacité 100 % puis 45 %),
  piliers inclus ou non, « liens seulement », fil d'Ariane, centre épinglé à l'origine, positions
  jamais enregistrées ; Échap revient à la vue globale.
- **Recherche** (`search.ts`, `ConstellationSearch.tsx`) : loupe ou `/`, 8 résultats (accents et
  casse ignorés), centrage (zoom ≥ 1,2), les correspondances restent pleines, le reste à 28 %.
- **Accessibilité** : liste texte masquée des tâches (nom, pilier, statut) navigable au clavier,
  cibles ≥ 44 px, `aria-pressed` sur les segments.
- **Non fait** : les curseurs « Forces » (attraction, répulsion) du popover, qui exigent de modifier
  `force-layout.ts` ; « Réorganiser le graphe » recalcule la disposition avec les forces actuelles.

## Niveau de pilier
`pillar-tiers.ts` : le palier du pilier (Novice → Légende) fixe la taille, le halo et le nombre de
branches de son étoile.

## Accès
Verrouillée pour les invités (`LockableFeature = 'constellation'`) quand les comptes existent.
