# Scores saisis par les joueurs — conception

Partie 2 du chantier « Refonte des ligues » (#117), issue #124. Reprend les questions de #51.
Décisions prises avec le propriétaire le 18 octobre (les trois compléments — effacement, égalité à 3 et plus, saisie de l’organisateur — validés le même jour).

## Aujourd'hui

- Seuls l'organisateur d'une ligue et les admins saisissent ou effacent un score (`refuseItemScore`, `lib/leagues/item-access.ts`), depuis « Gérer » (`components/admin/RoundRobinPanel.tsx`, `PlayoffsPanel.tsx`).
- Scores BO3 acceptés : 2-0, 2-1, 1-1, 1-2, 0-2 (playoffs : sans 1-1). Une ligue close refuse toute écriture.
- Les statistiques et les pages de ligue attribuent un match au deck **actuel** de l'inscrit (`league_players.deck_id`) : changer de deck réécrit le passé (#51).
- Égalité parfaite au classement (points, différence de manches, victoires) : l'ordre retombe sur l'ordre d'arrivée des joueurs (`lib/leaderboard.ts`).

## Décisions

1. **Saisie par les joueurs.** Chacun des deux joueurs d'un match (round-robin **et** playoffs) peut saisir son score. Le score **compte tout de suite** au classement ; en playoffs, le gagnant avance dès la saisie (même logique qu'aujourd'hui, y compris le refus de changer le vainqueur d'une demi-finale quand la finale a déjà un score).
2. **Correction.** Les deux joueurs du match peuvent corriger un score déjà saisi, autant de fois que nécessaire tant que la ligue est ouverte. L'organisateur et les admins gardent tous leurs droits (saisir, corriger, effacer). Effacer un score reste réservé à l'organisateur et aux admins : un joueur corrige, il ne remet pas un match à « non joué ».
3. **Physique ou en ligne.** Pas de choix à l'avance : la fenêtre de saisie demande « En physique » ou « En ligne » (obligatoire, « En physique » présélectionné). Les matchs déjà joués n'ont pas de valeur (rien d'affiché). La partie 3 (#125) remplira ce champ toute seule pour un match joué sur le site.
4. **Prévenir l'adversaire, sur le site seulement.** Le match affiche « Saisi par Ana » (ou « Corrigé par Bastien »). Tant que l'adversaire de celui qui a saisi n'a pas vu le score, une pastille « À vérifier » apparaît pour lui sur ce match et sur l'onglet « Calendrier » (ou « Playoffs ») de la ligue. Elle disparaît quand il ouvre cet onglet. Pas de mail. Une saisie de l'organisateur ou d'un admin qui n'est pas joueur du match met la pastille aux deux joueurs.
5. **Désaccord.** Pas de bouton « Contester » : l'adversaire corrige lui-même. Chaque saisie est gardée dans un **journal du match** (qui, quand, quel score, physique ou en ligne). L'organisateur voit, dans « Gérer », les matchs dont le score a été saisi par les deux joueurs avec des valeurs différentes (« Scores différents ») et peut trancher en corrigeant ; le journal s'affiche en dépliant le match.
6. **Deck figé dans le match.** À chaque saisie, le match retient pour chaque joueur le deck inscrit à ce moment-là : son identifiant, son nom et l'image du commandant. Statistiques, historique et pages de ligue lisent ce deck figé ; changer de deck ou réimporter un deck plus tard ne modifie plus les anciens matchs. Pour les matchs déjà joués, la migration fige le deck inscrit au moment de la migration (on ne peut pas retrouver mieux).
7. **Départage des égalités.** Après points, différence de manches et victoires : **confrontation directe** (le match entre les deux joueurs à égalité, s'il est joué et non nul). Si elle ne départage pas, ou à plus de deux joueurs à égalité où elle ne tranche pas, **tirage au sort fixe** : un ordre pseudo-aléatoire calculé à partir de l'identifiant de la ligue et de celui du joueur, le même à chaque affichage. À plus de deux joueurs à égalité, la confrontation ne compte que les matchs entre eux (mini-classement aux points entre eux), puis le tirage fixe.

## Données (migration `0018_player_scores.sql`)

Sur `matches` et `playoffs` (colonnes facultatives, NULL pour l'existant) :

| Colonne | Rôle |
|---|---|
| `played_mode` | `'physical'` ou `'online'` |
| `scored_by_player_id` | dernier joueur à avoir saisi (NULL si organisateur ou admin non joueur) |
| `scored_at` | instant de la dernière saisie |
| `unseen_by` | joueur qui doit encore voir le score (`'p1'`, `'p2'`, `'both'` ou NULL) |
| `deck1_id`, `deck1_name`, `deck1_image` | deck figé du joueur 1 |
| `deck2_id`, `deck2_name`, `deck2_image` | deck figé du joueur 2 |

Nouvelle table `score_entries` (journal) : `id`, `league_id`, `item_kind` (`'match'` ou `'playoff'`), `item_id`, `user_id` (auteur), `player_id` (NULL si l'auteur n'est pas joueur du match), `score_p1`, `score_p2`, `played_mode`, `created_at`. Effacée avec la ligue.

La migration remplit `deck*` des matchs et playoffs déjà joués avec le deck inscrit actuel.

Décalage au déploiement : le site peut tourner une à deux minutes sur l'ancienne base. Les nouvelles lectures tolèrent l'absence des colonnes (repli sur le deck inscrit, rien d'affiché) ; une saisie de joueur pendant ce court moment échoue proprement (« Réessaie dans un instant »), sans perte.

## Droits

- **Saisir ou corriger** (`PATCH /api/matches/[id]`, `PATCH /api/playoffs/[id]`) : gérer la ligue, **ou** être l'un des deux joueurs du match (compte joueur, pas le compte de démarrage) dans une ligue qu'il peut voir. Ligue close : refusé à tous, comme aujourd'hui.
- **Effacer** (`DELETE`) : gérer la ligue (inchangé).
- **Marquer comme vu** : nouveau `POST /api/leagues/[id]/seen`, appelé à l'ouverture du calendrier ou des playoffs ; ne touche que les matchs où l'appelant est attendu.
- Un joueur ne voit jamais d'autre journal que celui de ses matchs ; l'organisateur et les admins voient tous ceux de la ligue.

## Interface

- **Calendrier** (`/ligues/<id>/calendrier`) : sur chacun de mes matchs, bouton « Saisir le score » (ou « Corriger »). La fenêtre de score existante (`ScoreModal`) gagne le choix « En physique / En ligne ». Sous le score : « Saisi par Ana · en physique », et la pastille « À vérifier » le cas échéant.
- **Playoffs** (`/ligues/<id>/playoffs`) : même bouton sur mes matchs de playoffs.
- **Onglets de la ligue** : pastille sur « Calendrier » ou « Playoffs » quand un de mes matchs y est à vérifier.
- **Gérer** : badge « Scores différents » sur les matchs concernés, journal en dépliant le match.
- **Classement** : ordre selon le nouveau départage ; une infobulle ou une note sous le tableau explique l'ordre (« À égalité : confrontation directe, puis tirage au sort »).
- Téléphone : boutons de 44 px, fenêtre de score lisible à 375 px (les pages de ligue restent utilisables sur téléphone, contrairement à la table).

## Tests et vérification

- Vitest : droits (joueur du match, autre inscrit, visiteur, organisateur, admin, ligue close), journal, pastille (qui la reçoit, effacement), deck figé (changement de deck après saisie), départage (2 et 3 joueurs à égalité, confrontation nulle, tirage stable), migration (remplissage des decks).
- Navigateur : `scripts/leagues-check.mjs` étendu (ou nouveau `scripts/scores-check.mjs`) : Ana saisit un score en physique, Bastien voit la pastille puis corrige, l'organisateur voit « Scores différents », un troisième inscrit ne peut pas saisir ; playoffs ; téléphone 375 × 812.

## Hors de cette partie

- Remplissage automatique du score d'un match joué en ligne (partie 3, #125).
- Rondes suisses (partie 1 bis, #123).
- Mail à l'adversaire.
