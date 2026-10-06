# Design — Nouvelle mise en page de la table (plus d'espace de jeu)

**Date :** 2026-10-05
**Statut :** Validé avec l'utilisateur (issue #22)
**Remplace :** §4 « Disposition » de `2026-10-05-online-table-design.md` pour la disposition à l'écran ; le reste de cette spec (sources, glisser-déposer, repères d'activité, menus) ne change pas.

---

## Contexte

Comparée au goldfish de Moxfield, la table est jugée trop chargée et ses champs de bataille trop petits. Constat sur une capture en Duel et à 4 joueurs (1600 × 1000) :

- la barre du site (Classement, Calendrier…) reste affichée au-dessus de la barre de la table, soit deux bandeaux empilés ;
- chaque joueur a une ligne de compteurs pleine largeur (vie, poison, blessures, « + compteur », Monarque, Initiative) ;
- mes piles occupent une colonne de quatre grands blocs (≈ 145 px de large sur toute la hauteur), souvent vides ;
- en conséquence, les cartes sont petites et beaucoup de place reste vide.

But : donner le plus de place possible aux champs de bataille, sans retirer aucune fonction.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Plein écran | oui, pendant une partie (en ligne et mode test), sans la barre du site |
| Compteurs | pastille compacte (nom, vie ±, badges des compteurs non nuls) et bulle de détail |
| Mes piles | petites vignettes alignées à droite de la main, comme Moxfield |
| Taille des cartes | automatique, plus un réglage « Taille des cartes » dans Réglages |
| Multijoueur (3 à 5) | même principe qu'aujourd'hui (bandeaux « Tous », vue agrandie), en plus compact |
| Écrans | ordinateur d'abord (à partir de 1280 × 720) ; tablette en paysage utilisable sans être optimisée ; **la tablette fera l'objet d'un chantier ensuite** |
| Découpage | refonte par étapes dans les composants existants, une issue par changement visible |

## Hors périmètre

Optimisation tablette (chantier suivant) ; téléphone ; moteur de jeu (`lib/game/` : aucune action ni règle ne change) ; contenu des menus clic droit.

---

## 1. Plein écran et disposition générale

- Sur la page d'une partie en ligne (`/tables/[id]`) et du mode test (`/decks/[id]/test`), la table couvre toute la fenêtre, barre du site comprise. Aujourd'hui, `OnlineTable` est posée en `fixed` sous la barre du site (`top-16`) ; elle passe à `inset-0` au-dessus de la barre (`z` supérieur). Le mode test suit la même règle.
- La barre de la table reste la seule barre, inchangée ; « ← Salon » (en ligne) ou « ← nom du deck » (mode test) ramène au site.
- **Ma ligne du bas** : ma pastille à gauche, ma main au centre, mes quatre piles en vignettes à droite. La ligne de compteurs pleine largeur disparaît.
- **Adversaire en Duel** (ou adversaire agrandi) : une ligne fine au-dessus de son champ de bataille, avec sa pastille, sa main et sa bibliothèque en nombre, et ses piles en mini-vignettes.
- **Hauteurs indicatives** :

| | Adversaires | Mon champ de bataille | Ma ligne du bas |
|---|---|---|---|
| Duel | ≈ 40 % | ≈ 45 % | ≈ 15 % |
| 3 à 5 joueurs | ≈ 38 % | ≈ 47 % | ≈ 15 % |

- Spectateur : la moitié basse affiche les bandeaux des joueurs restants, comme aujourd'hui, en plein écran lui aussi, avec le bandeau « Tu regardes cette partie ».

## 2. Pastille d'un joueur et bulle de détail

**Pastille (toujours visible)** :
- point vert ou gris (en ligne ou non), nom, couronne de l'hôte ;
- vie avec − et + (Maj + clic = ±5, comme aujourd'hui) ;
- badges, **seulement quand la valeur n'est pas nulle** : poison, la plus forte blessure de commandant reçue (nom du commandant et valeur), chaque compteur libre, Monarque, Initiative ;
- badge en rouge à l'approche du seuil (poison ≥ 8, blessures ≥ 18) et au seuil (`POISON_LETHAL`, `COMMANDER_DAMAGE_LETHAL`) ;
- joueur actif : bordure dorée ; joueur éliminé : pastille grisée, nom barré ;
- bouton « ⋯ » qui ouvre la bulle.

**Bulle** :
- tous les réglages actuels du panneau de joueur : vie, poison, blessures de chaque commandant adverse, compteurs libres et « + compteur », Monarque, Initiative ;
- se ferme par Échap ou par un clic à côté ;
- spectateur ou partie terminée : lecture seule (valeurs sans boutons).

**Dans un bandeau d'adversaire** : un clic sur son nom l'agrandit, comme aujourd'hui ; « ⋯ » ouvre sa bulle.

Le contenu de la bulle reprend la logique de `PlayerPanel` (même actions envoyées au moteur) ; seule sa présentation change.

## 3. Piles en vignettes

**Mes piles** (à droite de ma main) :
- quatre vignettes au format carte, à la hauteur de la main, avec un nom court et le nombre de cartes : « Cmd », « Bib. 62 », « Cim. 3 », « Exil 0 » ;
- contenu identique à aujourd'hui : commandant(s) avec la taxe (deux commandants légèrement décalés), dos de carte ou carte du dessus connue pour la bibliothèque (#18, #19), dernière carte arrivée au cimetière et en exil, cadre en pointillé si la pile est vide ;
- gestes identiques : glisser vers ou depuis une vignette, double-clic sur la bibliothèque pour piocher, clic droit sur la bibliothèque pour son menu, clic sur le cimetière ou l'exil pour la liste.

**Piles d'un adversaire agrandi** : mini-vignettes (≈ 40 px de haut) sur sa ligne fine, avec les mêmes gestes qu'aujourd'hui.

## 4. Bandeaux d'adversaires (vue « Tous »)

- En tête, la pastille du joueur (§2).
- En dessous, une ligne fine : main et bibliothèque en nombre, commandant, mini-vignettes du cimetière et de l'exil.
- Le reste du bandeau : les trois rangées triées (Créatures, Autres, Terrains), sur toute la largeur.
- Principe inchangé : 2 adversaires en deux bandeaux pleine largeur, 3 ou 4 en grille de deux colonnes ; clic sur le nom pour agrandir, onglets des autres et bouton « Tous ».

## 5. Taille des cartes

- Nouveau réglage dans **Réglages** (`lib/table-settings.ts`, mémorisé sur l'appareil) : « Taille des cartes », au choix 80 %, 90 %, 100 %, 115 %, 130 %, 150 % ; défaut 100 %.
- Une valeur enregistrée invalide ou absente revient à 100 % (même règle que les autres réglages).
- Il s'applique aux cartes des champs de bataille affichés en grand (le mien, celui d'un adversaire agrandi), pas aux bandeaux ni à la main.
- À 100 %, la taille actuelle est conservée : 7 % de la largeur du champ de bataille, au moins 72 px. Le réglage multiplie ces deux valeurs.

## 6. Vérifications

- `npm test` reste vert ; tests unitaires pour le nouveau réglage (lecture, valeurs invalides) et pour le choix des badges de la pastille (fonction pure : quels badges, quelle couleur).
- `npx tsc --noEmit` et `npx @cloudflare/next-on-pages`.
- `scripts/playtest-check.mjs` et `scripts/online-check.mjs` adaptés aux nouveaux emplacements. Les attributs `data-zone`, `data-player`, `data-board`, `data-strip` restent posés sur les zones, pour que les contrôles et le glisser-déposer continuent de les trouver.
- Captures jointes à chaque PR : Duel et 4 joueurs, en 1600 × 1000 et en 1280 × 720.

## 7. Découpage en tâches

Une issue par tâche, dans cet ordre ; chacune dépend de la précédente (mêmes fichiers de la table) :

1. **Plein écran** : table en `inset-0` au-dessus de la barre du site, en ligne et en mode test.
2. **Pastille et bulle** : nouveau composant de pastille, bulle reprenant `PlayerPanel`, utilisés pour moi et pour l'adversaire agrandi.
3. **Piles en vignettes** : mes piles à droite de la main, mini-vignettes pour l'adversaire agrandi ; nouvelles hauteurs du Duel.
4. **Bandeaux compacts** : pastille et ligne fine dans les bandeaux, rangées sur toute la largeur ; hauteurs du multijoueur.
5. **Taille des cartes** : réglage et application aux grands champs de bataille.
