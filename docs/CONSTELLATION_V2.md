# Constellation v2 — « Graphe sobre »

Refonte **visuelle et ergonomique** de la constellation (lot 6B, voir `docs/CONSTELLATION.md`).
Objectif : un rendu sobre et professionnel façon Obsidian, qui ne fasse pas « vibecodé ».
Les données, le calcul du graphe et la simulation ne changent pas : on refait le **dessin** et
l'**interface** autour.

Maquettes de référence : `docs/design/constellation-v2/` (A1 inspecteur, A2 plein cadre,
A3 vue locale). En cas de doute, ce document fait foi, les maquettes montrent l'intention.

## Principes

1. **Aucune lueur.** Pas de halo, pas de dégradé radial, sur aucun nœud. C'est le premier
   marqueur de « vibecodé » à supprimer.
2. **Un seul accent** (`--accent`, violet) réservé à la sélection et aux liens créés par
   l'utilisateur. Les couleurs des piliers ne servent qu'à colorer les nœuds.
3. **Le reste s'efface** quand on survole ou sélectionne : on montre le voisinage, on estompe
   tout le reste.
4. **Chrome discret** : barres flottantes compactes, chiffres à chasse fixe
   (`font-variant-numeric: tabular-nums`), petites capitales espacées pour les titres de section.
5. Tout fonctionne en **thème sombre et clair**, à la souris et au doigt (iPad), cibles ≥ 44 px.

## Ce qu'on garde tel quel

- `build-graph.ts` (filtres, rayons, regroupement « +N »), `force-layout.ts`,
  `view-transform.ts`, `link-rules.ts`, `useTaskLinks`, `useConstellationLayout`,
  `useConstellationSync`, migrations et stockage.
- Gestes de `ConstellationCanvas.tsx` : zoom molette/pincement, pan, glisser, épingler,
  double-clic pour relâcher, **verrou**, mode « relier ».
- Accès verrouillé pour les invités (`LockableFeature = 'constellation'`).
- Le fond d'écran `ConstellationBackground` réutilise `drawConstellation` : il hérite du
  nouveau rendu automatiquement, sans étiquettes, comme aujourd'hui.

## Comportement d'ensemble (synthèse des 3 maquettes)

- **Au repos** : plein cadre (maquette A2). Le graphe occupe tout l'écran, l'interface flotte
  par-dessus.
- **Sélection d'une tâche** : un panneau **inspecteur** s'ouvre à droite (maquette A1) ; sur
  téléphone, c'est une feuille qui monte du bas.
- **Vue locale** : bouton Globale / Locale (maquette A3). La tâche sélectionnée passe au centre
  avec ses voisins jusqu'à une profondeur 1, 2 ou 3.

## Jetons visuels

À ajouter dans `src/shared/design-system/tokens.css`, dans les deux thèmes, et à lire depuis
le canvas via `getComputedStyle` (comme la palette actuelle). Ne jamais coder les hex en dur
dans les composants.

| Jeton | Sombre | Clair | Usage |
|---|---|---|---|
| `--cst-bg` | `#0e0c14` | `#f4effc` | fond du graphe |
| `--cst-chrome` | `rgba(22,20,27,.78)` | `rgba(255,255,255,.82)` | barres flottantes (avec `backdrop-filter: blur(16px)`) |
| `--cst-chrome-line` | `rgba(255,255,255,.08)` | `rgba(40,20,80,.12)` | bordures du chrome |
| `--cst-edge` | `#3a3647` | `#d6cde8` | liens implicites (pilier → tâche) |
| `--cst-edge-user` | `#8a8499` | `#665f7c` | liens créés (dépendance, liée), au repos |
| `--cst-label` | `#8a8499` | `#4f4866` | étiquettes de tâches |
| `--cst-label-strong` | `#eeeaf4` | `#1e1830` | étiquettes de piliers, nœud sélectionné |
| `--cst-highlight` | `#c9a7ff` | `#5a1fd1` | liens et anneau de la sélection |

Couleurs des nœuds : `pillar.color` inchangé (choisi par l'utilisateur).

## Lot 1 — Nouveau rendu (`draw-constellation.ts`)

**Nœuds**
- Tâche terminée : disque plein `pillar.color`, avec un **liseré de 2 px couleur `--cst-bg`**
  pour le détacher des liens. Aucun dégradé.
- Tâche à faire : disque `--cst-bg` + contour 1,5 px `pillar.color`. On supprime le remplissage
  progressif selon `brightness`.
- Pilier : disque plein (rayon 11 px de base × `tier.star.scale` plafonné à 1,4) + **un anneau
  fin** à rayon + 5 px, `pillar.color` à 35 % d'opacité. **On supprime l'étoile à branches**
  (`starPath`). Le palier reste visible dans l'inspecteur, pas dans la forme.
- Groupe « +N » : inchangé dans l'esprit, mais sans fond translucide, contour pointillé seul.
- Archivé : opacité 0,45.
- Rayon des tâches : garder `taskRadius`, mais le plafonner à 9 px (lisibilité, pas d'énormes
  bulles).

**Liens**
- Pilier → tâche : 1 px `--cst-edge`, opacité pleine (la couleur est déjà discrète).
- Parent → sous-tâche : 1 px `--cst-edge-user` à 50 %.
- `depends_on` : 1,3 px `--cst-edge-user` + petite flèche (6 px) qui s'arrête au bord du nœud.
- `related` : 1,3 px `--cst-edge-user`, pointillés `4 4`.

**Survol / sélection** (nouvelle fonction pure `neighborhood(graph, id)` dans un fichier
`neighborhood.ts`, testée)
- Nœud actif + voisins directs + liens entre eux : pleine opacité. Tout le reste : **28 %**.
- Liens du voisinage en `--cst-highlight` (1,4–1,6 px), flèches comprises.
- Nœud actif : anneau `--cst-label-strong` 1,5 px à rayon + 5 px ; son étiquette en gras.

**Étiquettes**
- Police `--font-sans` 10,5 px (tâches), 11,5 px semi-gras (piliers), taille écran constante
  (comme aujourd'hui), liseré `--cst-bg`.
- Mode **Auto** (défaut) : piliers toujours ; tâches à partir d'un zoom ≥ 1,15 **ou** si elles
  font partie du voisinage actif. Modes **Toujours** et **Jamais** dans les réglages.
- Troncature à 28 caractères conservée.

**Tests** : adapter `draw-constellation` (snapshot existant), ajouter `neighborhood.test.ts`.

## Lot 2 — Interface plein cadre (`ConstellationPage.tsx`)

Remplacer l'en-tête actuel (titre + ligne de stats + selects) par :

- **Haut gauche** : titre « Constellation » (`--font-display`, 20 px, 600) et dessous, en
  12 px : « **12/18** terminées · **25 h 30** de focus ».
- **Haut centre**, barre flottante (`--cst-chrome`, rayon 14 px) :
  - une **puce par pilier** : pastille couleur + nom + heures. Elle sert de légende **et** de
    filtre (clic = afficher/masquer ce pilier ; remplace le select « Pilier »). Pilier sans
    tâche : puce estompée, pastille en contour ;
  - séparateur, puis segment **30 j / 90 j / Tout** (remplace le select « Période »).
  - Sur téléphone, la barre défile horizontalement (pas de retour à la ligne).
- **Haut droite** : bouton Réglages (ouvre un popover) + bouton Fermer, 44 × 44.
- **Popover Réglages** (288 px, fermé par Échap ou clic extérieur) :
  - *Affichage* : Étiquettes (segment Auto / Toujours / Jamais), Tâches à faire, Flèches de
    dépendance, Tâches archivées (remplace la case actuelle), Taille des nœuds (curseur
    0,6×–1,6×) ;
  - *Forces* : Attraction vers le pilier, Répulsion (curseurs qui modifient les paramètres de
    `createSimulation` et relancent un calcul) ;
  - pied : « Réinitialiser » et « Réorganiser le graphe » (dé-épingle tout et relance).
  - Réglages mémorisés en `localStorage` (même principe que `readLocked`).
- **Bas gauche**, pilule de zoom : − / **pourcentage** / + | Tout afficher | Verrou | Relier.
- **Bas droite** : **mini-carte** 156 × 100 (canvas séparé, points de 2–3 px aux couleurs des
  piliers, rectangle de la vue courante ; clic/glisser dedans déplace la vue). Masquée sous
  640 px de large.
- **Bas centre** : aide discrète en `--muted` 12 px : « Glisse un nœud pour le placer ·
  double-clic pour le relâcher ». Disparaît après la première interaction (mémorisé).
- Le mode « relier » garde sa logique ; son bandeau passe dans le même style de barre flottante.

## Lot 3 — Inspecteur

Nouveau composant `ConstellationInspector.tsx`, affiché quand une tâche est sélectionnée.
Remplace l'actuel bloc de détail.

- Bureau / iPad paysage : panneau de 320 px à droite (le graphe se réduit, pas de recouvrement).
  Téléphone / iPad portrait : feuille en bas, hauteur ~55 %, poignée pour la fermer.
- Contenu, de haut en bas :
  1. pastille + nom du pilier, bouton Désélectionner ;
  2. titre de la tâche (`--font-display`, 22 px) ;
  3. statut : « Terminée le 27 oct. » (pastille verte, `doneAt`) ou « À faire » (neutre).
     Si la tâche a des `depends_on` tous terminés : encart vert « Débloquée : *X* est terminée,
     tu peux t'y mettre. » ; sinon encart neutre listant ce qui bloque ;
  4. deux chiffres : temps de focus total, nombre de sessions (sous-tâches incluses, comme
     `build-graph`) ;
  5. mini-histogramme **focus par semaine** sur la période filtrée (barres couleur du pilier,
     semaines vides en trait fin) ;
  6. **Liens** : une ligne par lien (« Dépend de », « Débloque », « Liée à ») avec le nom de
     l'autre tâche, son pilier si différent, et son statut ; clic = sélectionner cette tâche.
     Bouton pointillé « Relier à une tâche » (lance le mode relier depuis cette tâche) ;
     suppression d'un lien conservée (avec annulation) ;
  7. pied : « Ouvrir la tâche » (ou « Marquer terminée » si à faire) et **« Lancer un focus »**
     (bouton accent) qui ferme la constellation et démarre une session sur cette tâche.
- Sélection d'un **pilier** : même panneau, version courte (palier + niveau, heures, tâches
  terminées / total, bouton « Voir en vue locale »).

## Lot 4 — Vue locale

- Segment **Globale / Locale** en haut à gauche, sous le titre. « Locale » est désactivé tant
  que rien n'est sélectionné.
- En vue locale : seuls la tâche centrale et ses voisins jusqu'à la profondeur choisie sont
  affichés (fonction pure `localSubgraph(graph, id, depth, { includePillars })`, testée).
  - Profondeur 1 : opacité pleine. Profondeur 2 et 3 : 45 %.
  - Disposition : la tâche centrale épinglée au centre, simulation lancée sur le sous-graphe
    seulement ; positions **non sauvegardées** (la disposition globale reste intacte).
  - Nœud central : anneau `--cst-label-strong` à rayon + 7 px, étiquette en `--font-display`.
- Petite carte flottante en haut à gauche : Profondeur (segment 1 / 2 / 3, défaut 2),
  « Inclure les piliers » (défaut oui), « Liens seulement » (masque les liens implicites
  pilier → tâche).
- Fil d'Ariane : Tous les piliers › *Pilier* › *Tâche*. Cliquer le pilier recentre sur lui.
- **Échap** ou « Globale » : retour à la vue globale avec la même sélection.
- Sélectionner un voisin en vue locale le recentre (animation douce, 250 ms, désactivée si
  `prefers-reduced-motion`).

## Lot 5 — Recherche

- Bouton loupe + raccourci **/** (bureau). Champ dans la barre du haut ; liste de résultats
  (8 max) : nom, pastille du pilier, statut.
- Choisir un résultat : le sélectionne, centre la vue dessus (zoom ≥ 1,2) et ouvre l'inspecteur.
- Pendant la frappe, les nœuds qui correspondent restent pleins, les autres passent à 28 %.

## Accessibilité

- Tous les boutons icône ont un `aria-label` ; segments en `role="group"` + `aria-pressed`.
- Le canvas garde un équivalent texte : liste masquée visuellement des tâches visibles
  (nom, pilier, statut), navigable au clavier ; Entrée = sélectionner.
- Contrastes ≥ 4,5:1 pour le texte du chrome dans les deux thèmes.
- Toutes les animations respectent `prefers-reduced-motion`.

## Textes

Toutes les chaînes dans `src/shared/i18n/fr.ts` (section `constellation`), pas en dur.

## Ordre de travail

Un lot = une PR/commit, tests verts (`npm run test`, `npm run lint`, e2e `constellation.spec.ts`
mis à jour) avant de passer au suivant. Lot 1 d'abord : c'est lui qui change le plus le rendu
perçu. Mettre à jour `docs/CONSTELLATION.md` à la fin.

## Hors périmètre

Pas de nouvelle table, pas de changement de synchronisation, pas de nouveau type de lien, pas
de 3D, pas de lueur ni de particules.
