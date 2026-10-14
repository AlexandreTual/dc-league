# Design — Colonne joueur façon MTGO (vie et cimetière bien visibles)

**Date :** 2026-10-06
**Statut :** Validé avec l'utilisateur (issue #80)
**Maquette :** https://claude.ai/artifact/SLrswVXfAH4ezsCXkK2AQj (écrans « A · Colonne joueur façon MTGO » et « 4 joueurs · 2 »)
**Remplace :** §2 (pastille), §3 (piles en vignettes) et §4 (bandeaux) de `2026-10-05-table-layout-design.md` pour leur présentation. Le plein écran (§1) et la taille des cartes (§5) ne changent pas.

---

## Contexte

Après la nouvelle mise en page (#22, PR #78), deux informations restent peu visibles :

- la vie est un chiffre de 12 px dans la pastille du joueur ;
- le cimetière est une vignette parmi quatre, avec « Cim. 1 » écrit en 10 px.

On s'inspire de MTGO : un bloc par joueur sur le bord gauche, avec la vie en gros chiffres, les piles chiffrées et les dernières cartes du cimetière lisibles.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Principe | option A de la maquette : un bloc joueur sur le bord gauche (« colonne ») |
| Portrait | ligne compacte : petite image, nom, −/+, vie en gros chiffres ; pas de grand cadre |
| Vie basse | le chiffre passe en rouge à **10 ou moins** |
| Cimetière | cascade des **6 dernières cartes** (5 si la hauteur manque) ; un clic ouvre tout le cimetière avec ses filtres |
| 3 à 5 joueurs | option 2 : ma colonne comme en Duel ; chaque bandeau adverse commence par sa propre ligne portrait |
| Mode test | la vie n'est que dans ma colonne, plus dans la barre du haut |
| Adversaire agrandi (3 à 5) | sa colonne à gauche de son plateau, comme en Duel (retour du 6 octobre après essai : d'abord prévue au-dessus) |
| Bandeaux (3 à 5) | colonne compacte à gauche de chaque bandeau, cartes agrandies (retour du 6 octobre après essai) |
| 5 joueurs | les quatre bandeaux côte à côte, sur une seule rangée |

## Hors périmètre

- Tablette (#81) et fenêtres séparées (#82) : chantiers suivants, qui réutiliseront ces blocs.
- Moteur de jeu (`lib/game/apply.ts`, `view.ts`, `room.ts`) : aucune action ni règle ne change, **aucun nouveau champ dans l'état de partie**. C'est donc compatible avec le serveur de jeu en production.
- Contenu des menus clic droit et de la fenêtre de pile (`PileModal`), qui a déjà ses filtres par nom et par type.
- La colonne de droite de la maquette (aperçu et activité) illustrait l'existant : l'aperçu flottant (`PreviewPane`) et les lignes d'activité (`ActivityFeed`) ne changent pas.

---

## 1. Disposition

Le bloc d'un joueur reste **à l'intérieur de son plateau** (`data-board`), à gauche. Les contrôles navigateur et le glisser-déposer continuent donc de trouver ses zones dans son plateau.

| Partie | Haut de l'écran | Bas de l'écran |
|---|---|---|
| Mode test | — | ma colonne · (mon champ de bataille, ma main) |
| Duel | colonne de l'adversaire · (bande de sa main, son champ de bataille) | ma colonne · (mon champ de bataille, ma main) |
| 3 à 5, vue « Tous » | bandeaux adverses côte à côte, chacun avec sa colonne compacte à gauche | ma colonne · (mon champ de bataille, ma main) |
| 3 à 5, adversaire agrandi | onglets, puis colonne de l'adversaire · (bande de sa main, son champ de bataille) | ma colonne · (mon champ de bataille, ma main) |

- **Largeur de la colonne : 216 px**, la même pour l'adversaire en Duel et pour moi : les deux blocs s'alignent sur le bord gauche.
- Hauteurs inchangées : adversaires 40 % en Duel et 38 % à 3 à 5 joueurs ; ma main reste à 25 % de mon plateau.
- Ma main occupe toute la largeur à droite de ma colonne : les quatre vignettes de piles à côté de la main disparaissent, et ma pastille aussi.
- À 3 à 5 joueurs, ma colonne commence sous les bandeaux, et non en haut de l'écran comme sur la maquette. Les bandeaux gagnent ainsi toute la largeur, ce qui compte à 5 joueurs.
- **Spectateur** : aucune colonne. Tous les joueurs sont en bandeaux, comme aujourd'hui.
- **Écran étroit (moins de 640 px)** : la colonne passe sur une ligne au-dessus de la main (ligne portrait et cases seulement), comme les vignettes aujourd'hui. Le téléphone n'est plus une cible ; #81 traitera la tablette.

## 2. Colonne d'un joueur (moi, et l'adversaire en Duel)

De haut en bas :

1. **Ligne portrait** (`data-panel={joueur}`), dans un cadre doré pendant le tour du joueur :
   - **portrait** de 44 px : l'image de son commandant (le premier, où qu'il soit), recadrée sur l'illustration ; sans commandant, l'initiale de son nom sur fond uni ;
   - nom (`data-testid="player-name"`), point vert ou gris (en ligne ou non), couronne de l'hôte, « éliminé », « choisit sa main… » ;
   - boutons − et + compacts (Maj + clic = ±5, comme aujourd'hui), avec les mêmes noms accessibles qu'aujourd'hui (« moins : points de vie », « plus : points de vie ») ;
   - **vie en 52 px** (`data-testid="player-life"`), en rouge à 10 ou moins ;
   - bouton « ⋯ » qui ouvre la bulle actuelle (`data-bubble`) avec tous les réglages : vers le bas pour la colonne du haut, vers le haut pour la mienne ;
   - joueur éliminé : bloc grisé, nom barré.
2. **Badges** des compteurs non nuls, sous la ligne portrait : ceux d'aujourd'hui (`playerBadges`), avec les mêmes seuils et couleurs.
3. **Quatre cases chiffrées** : Main, Bib., Cim., Exil (§4).
4. **Commandant** : la zone de commandement (`data-zone="command"`) en petite vignette (deux commandants légèrement décalés, taxe affichée sur la carte comme aujourd'hui), puis, pour chacun de ses commandants, son nom, où il se trouve (« zone de commandement », « en jeu », « au cimetière », « en exil », « en main ») et sa taxe. Sans commandant (deck importé sans commandant), il ne reste que la vignette vide de la zone de commandement, qui reste une cible de dépôt.
5. **Cimetière en cascade** (`data-zone="graveyard"`, `data-count`) : sans titre (le nombre est dans la case Cim. ; « Cimetière vide » quand il n'y a rien), les noms des 6 dernières cartes empilées, chacune sur un liseré de la couleur de sa carte, **la plus récente en bas**. Quand la hauteur manque, les plus anciennes sortent par le haut : la plus récente reste toujours visible.

## 3. Colonne compacte d'un adversaire (bandeau « Tous », 3 à 5 joueurs)

Après un premier essai (en-tête au-dessus des rangées), l'utilisateur a demandé le 6 octobre une colonne à gauche, comme pour soi, pour que les rangées gagnent toute la hauteur du bandeau et que les cartes soient plus grandes.

À gauche du bandeau, une colonne de 184 px (`data-header`) :
1. **Ligne portrait compacte** (`data-panel`) : portrait de 32 px, nom (clic : agrandir, comme aujourd'hui), point en ligne, couronne, − et +, « ⋯ » pour la bulle (vers le bas), **vie en 40 px** (rouge à 10 ou moins), badges en dessous.
2. **Quatre cases chiffrées** sur deux rangées (Main, Bib. / Cim., Exil).
3. La petite vignette de sa zone de commandement et la **dernière carte arrivée dans son cimetière** (`data-zone="graveyard"`, `data-count`) : son nom sur un liseré de sa couleur, ou « vide ».

À droite, ses trois rangées (Créatures, Autres, Terrains) sur toute la hauteur : côte à côte avec 2 adversaires, l'une sous l'autre à partir de 3. Cartes de 80 px de haut avec 2 adversaires, 56 px à partir de 3 (40 px auparavant).

**Adversaire agrandi** : la même colonne que la mienne et que celle du Duel (§2), puis la bande de sa main (cartes révélées comprises) et son champ de bataille.

Le bandeau du joueur dont c'est le tour a un cadre doré. Les bandeaux sont **tous sur une rangée** : 2, 3 ou 4 colonnes égales (5 pour un spectateur).

## 4. Cases chiffrées et gestes

Chaque case : un gros chiffre en gras (police du site, chiffres à chasse fixe `tabular-nums`) et un nom court. Pas de nouvelle police à charger. Les gestes d'aujourd'hui sont conservés :

| Case | Contenu | Gestes | Repères |
|---|---|---|---|
| Main | nombre de cartes | aucun | `data-testid="hand-count"` ; `data-zone="hand"` seulement dans un bandeau (pas d'autre main affichée) |
| Bib. | mini-vignette (dos, ou la carte du dessus quand elle est connue) et nombre | dépôt (Maj = dessous) ; le propriétaire glisse la carte du dessus et pioche par double-clic ; clic droit ou appui long : menu de la bibliothèque | `data-zone="library"`, `data-count` |
| Cim. | nombre, mis en avant en doré | dépôt ; clic : tout le cimetière (fenêtre de pile, filtres) | aucun (le repère est sur la cascade ou la dernière carte) |
| Exil | nombre | dépôt ; clic : la liste de l'exil | `data-zone="exile"`, `data-count` |

- La cascade et la ligne « dernière carte » sont aussi des cibles de dépôt pour le cimetière. Un clic les ouvre comme la case Cim.
- Chaque carte de la cascade, et la dernière carte du bandeau, se comporte comme une carte du cimetière aujourd'hui : glisser vers une autre zone, clic droit pour son menu, survol pour l'aperçu.
- L'exil n'affiche plus sa dernière carte : on la retrouve dans la liste, qui permet déjà de la déplacer.

## 5. Mode test

Comme en ligne, ma colonne affiche ma vie avec − et +. **Décidé dans #83 : la vie n'est plus que dans la colonne** ; elle disparaît de la barre du haut. La réserve de mana reste dans la barre du haut.

## 6. Vérifications

- `npm test` : tests unitaires du nouveau module pur `lib/game/player-summary.ts` (seuil de vie basse, cascade du cimetière, carte du portrait, emplacement d'un commandant).
- `npx tsc --noEmit`, `npm run lint`, `npx @cloudflare/next-on-pages`.
- `playtest-check`, `playtest-mobile-check` et `online-check` adaptés. Les repères `data-board`, `data-strip`, `data-panel`, `data-bubble`, `data-zone`, `data-player`, `data-count`, `player-name`, `player-life` et `hand-count` restent posés comme décrit ci-dessus.
- Nouveaux contrôles : colonne à gauche de mon champ de bataille ; vie en rouge à 10 ; cascade limitée aux 6 dernières, la plus récente en bas ; bandeaux sur une rangée.
- Captures jointes à chaque PR : mode test, Duel et 4 joueurs, en 1600 × 1000 et 1280 × 720, plus 5 joueurs en 1280 × 720 pour la lisibilité des bandeaux.

## 7. Découpage en tâches

Une issue par tâche, dans cet ordre (mêmes fichiers de la table) :

1. **Ma colonne** (#83) : module pur, composants de la colonne et des cases, ma colonne dans mon plateau (mode test et en ligne), fin de ma pastille et de mes vignettes de piles.
2. **Adversaire en Duel** (#84) : sa colonne à gauche de son plateau.
3. **En-têtes à 3 à 5 joueurs** (#85) : en-tête des bandeaux et de l'adversaire agrandi, bandeaux sur une rangée, fin de la pastille ; feuille de route.

---

## Mise à jour du 9 octobre : piles à côté de la main (façon Moxfield)

Après essai (PR #109), l'utilisateur a choisi une disposition à la Moxfield **par défaut** pour **mon** plateau :

- bibliothèque, cimetière, exil et commandement en vignettes au format carte, **à droite de ma main** (au-dessus de la main sous 640 px), avec nom court et nombre dessous ; toutes sont des cibles de dépôt ;
- Bib. : carte du dessus glissable, double-clic pour piocher, menu au clic droit ; Cim. et Exil : dernière carte arrivée, un clic ouvre la pile ; Cmd : commandants avec leur taxe ;
- ma colonne ne garde que la ligne portrait (vie, compteurs).

Le réglage de la table **« Piles dans la colonne (ancienne disposition) »** rétablit la colonne décrite au §2 (cases chiffrées, commandant, cimetière en cascade). Il est mémorisé sur l'appareil ; une sauvegarde d'avant (sans ce réglage) prend la nouvelle disposition. Le plateau de l'adversaire et les bandeaux ne changent pas.
