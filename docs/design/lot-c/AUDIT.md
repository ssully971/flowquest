# Lot C — état des lieux Tâches & Bloc-notes

Captures « avant » : `avant/before-{tasks,notes}-{light,dark}-{mobile,desktop}.png`.
Maquettes des deux directions : `maquette-{A,B}-{light,dark}.png` (source : `directions.html`).

## Ce qui fait « template violet généré par IA » aujourd'hui

1. **Accent violet fixe partout** (`--accent` #5a1fd1 / #a35cff) : bouton « + », case cochée, tâche
   active, focus de l'éditeur, bouton de mode sélectionné. Aucune couleur ne vient du contenu
   (pilier, fond). Seul le liseré gauche des tâches colorées sort du lot.
2. **Surfaces teintées violet** : `--surface` / `--surface-2` / `--line` sont des mauves
   (#f8f4ff, #dfd2f5…), y compris dans les panneaux de contenu, alors que `--panel-*` (neutres)
   existe déjà et n'est pas utilisé par Tâches/Notes.
3. **Halo identique partout** : `shadow-[0_10px_24px_var(--glow)]` (halo violet) sur panneaux,
   cartes, fenêtre ; même bordure `--line` à 1 px sur le panneau, l'input, la zone d'écriture.
4. **Verre générique** (GlassCard / mode « grande fenêtre ») : flou + voile translucide sans
   hiérarchie, contraste du texte dépendant de la photo de fond.
5. **Cadre de focus « plein violet »** autour de l'éditeur de notes (bordure accent + anneau),
   très voyant pour une zone de saisie longue.
6. **Rangée de tâche surchargée** : poignée, case, emoji, titre, durée, chevron, cible, archive,
   croix — 5 icônes de même poids visuel (gris moyen, 16 px) sans hiérarchie ; titre tronqué dès
   22 rem (« Réviser la phar… »).
7. **Cibles tactiles < 44 px** : poignée (16 px), cases 20 px, boutons `p-1.5` (~28 px), outils
   de note 32 px.
8. **Typographie sans caractère** : tout en `text-sm` / `text-xs` Instrument Sans ; Bricolage et
   Montserrat absents des panneaux (titre « Tâches » = simple `font-semibold` 14 px).
9. **Case à cocher ronde 20 px** sans animation ; tâche terminée = barré gris seulement.
10. **États vides plats** : une phrase grise sans invitation à agir ; pas d'état de chargement.
11. **Bloc-notes** : barre d'outils pleine largeur avec 5 icônes identiques ; titres `h2`/`h3` à
    peine distincts du texte ; pas de style de citation ; « Enregistré » identique à l'état
    normal (aucun retour discret de sauvegarde).
12. **Pilier non affiché** sur les tâches (une tâche n'a pas de pilier aujourd'hui).

## Directions proposées

Les deux : accent **dérivé du pilier** (à défaut, du fond), surfaces neutres `--panel-*`, un seul
niveau d'ombre, cibles ≥ 44 px, `prefers-reduced-motion`.

- **A — Papier & encre** : surface opaque chaude, hairlines, Bricolage Grotesque pour les titres,
  Instrument Sans corps 15 px, Montserrat en micro-étiquettes ; case carrée arrondie à tracé du
  « ✓ » ; rangées 48 px ; AA garanti sur tout fond (surface opaque).
- **B — Verre teinté** : verre sombre/clair teinté par le fond (flou 26 px), titres de panneau en
  Montserrat capitales espacées ; case ronde à remplissage ; rangées 44 px ; AA assuré par un
  voile de surface ≥ 66 %.
