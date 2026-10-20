# Animations des joueurs et de la partie — conception

Date : 2026-10-20
Statut : réalisée (issue #191)
Suite de : `specs/2026-10-19-card-animations-design.md` (animations des cartes) ; réglage : fenêtre « Animations » (#192).

## But

Voir tout de suite ce qui change chez un joueur et dans la partie, surtout en ligne à 4–5 joueurs : vie, poison et blessures
de commandant, monarque et initiative qui passent d'un joueur à l'autre, joueur éliminé, victoire, lancer de dés.

Le donjon de l'initiative et d'« explorer le donjon » est un chantier à part (#193, `specs/2026-10-20-dungeons-design.md`) ;
sa case « Donjon » est déjà dans la fenêtre « Animations ».

## Règles communes

- Visible chez tous les joueurs, en mode test comme en ligne, et dans la fenêtre à part d'un plateau.
- Seulement quand la valeur change d'une vue à la suivante : rien au chargement de la page, à la reprise d'une partie, à la
  reconnexion ni à l'ouverture d'une fenêtre à part (même notion que l'éclat des légendaires).
- Chaque animation a sa case dans la fenêtre « Animations », groupe **Joueurs et partie** (mémorisé sur l'appareil, activée
  par défaut ; un réglage enregistré avant les active toutes) :
  - **Vie, poison et blessures** ;
  - **Monarque et initiative** ;
  - **Donjon** (#193) ;
  - **Élimination et victoire** ;
  - **Dés**.
- Seuls `transform` et `opacity` sont animés (le portrait d'un joueur éliminé est en noir et blanc, sans animation de couleur).
- Mouvement réduit (réglage du système) : version fixe, décrite pour chaque animation.
- Rien de nouveau dans l'état de partie ni dans le serveur de jeu : tout se lit dans la vue, déjà envoyée. Les animations
  marchent donc tout de suite avec le Worker de production. Pas de migration.

## Vie, poison et blessures de commandant (case « Vie, poison et blessures »)

Calcul (`playerChanges`, `lib/game/player-fx.ts`) : pour chaque joueur présent dans les deux vues, écart de vie, de poison,
et de la somme des blessures de commandant qu'il a reçues.

- **Vie** : l'écart (« −3 », « +2 ») s'envole au-dessus du nombre de points de vie puis s'efface (1,4 s) ; en rouge pour une
  perte, en vert pour un gain. Une perte fait trembler le nombre et un halo rouge s'allume derrière ; un gain l'agrandit un
  instant avec un halo vert.
- **Clics rapprochés** : les écarts du même joueur et du même type à moins de 1,2 s l'un de l'autre s'additionnent en un seul
  chiffre, qui repart (`addPops`). Trois clics sur « − » montrent « −3 », pas trois « −1 ». Un total nul n'affiche rien.
- **Poison** : « ☠ +1 » s'envole en vert, et des gouttes vertes coulent sur le portrait.
- **Blessures de commandant** : « ⚔ +5 » s'envole en rouge, et une épée frappe le portrait en diagonale. La pastille
  existante passe déjà en doré à 18 et en rouge à 21 (`player-badges.ts`), comme le poison à 8 et 10.
- Mouvement réduit : l'écart reste affiché, immobile, au-dessus du nombre le temps de l'animation ; pas de tremblement, de
  gouttes ni d'épée.

## Monarque et initiative (case « Monarque et initiative »)

Calcul : `view.monarch` et `view.initiative` changent d'un joueur (ou de personne) à un autre.

- D'un joueur à un autre : la couronne (ou le drapeau) s'envole du portrait de l'ancien vers la pastille « Monarque »
  (ou « Initiative ») du nouveau, en arc (1,1 s), puis la pastille apparaît.
- De personne à un joueur (ou si l'ancien portrait n'est pas à l'écran, comme dans la fenêtre à part) : l'icône jaillit
  au-dessus du portrait du nouveau avec un éclat doré.
- D'un joueur à personne : l'icône monte au-dessus de son portrait et s'efface.
- Mouvement réduit : pas de vol ; l'icône apparaît, immobile, sur le portrait du nouveau, le temps de l'animation.

## Élimination et victoire (case « Élimination et victoire »)

- **Joueur éliminé** (concession ou élimination) : des fissures s'ouvrent sur sa ligne portrait (0,9 s) ; ensuite son
  portrait reste en **noir et blanc, fissuré** (en plus de l'estompage, du nom barré et de « éliminé », déjà là). Case
  coupée : l'affichage d'avant (estompé, barré). Le noir et blanc et les fissures se voient aussi au chargement de la page ;
  seule l'ouverture des fissures est réservée au moment de l'élimination.
- **Victoire** (partie en ligne terminée avec un gagnant, chez tous les joueurs) : un écran par-dessus la table, avec le
  portrait du gagnant (illustration de son commandant), « Victoire de <nom> » et des confettis dorés qui tombent ; il se
  ferme d'un clic ou d'une touche, et seul au bout de 8 s. Le bandeau « Victoire de … » en haut de la table reste. Rien
  pour une partie close sans gagnant, rien au chargement d'une partie déjà finie. Pas de partie terminée en mode test.
- Mouvement réduit : fissures sans animation ; écran de victoire sans confettis.

## Dés (case « Dés »)

Le résultat est tiré par le serveur (inchangé) ; la ligne « Lance 3d6 : 4, 2, 6 (total 12) » est lue pour connaître le dé et
les résultats (`parseRoll`, `lib/game/dice.ts`), ce qui marche aussi avec un serveur de jeu plus ancien.

- Un plateau de dés apparaît au milieu de la table, avec le nom du joueur qui lance (pas pour mes propres lancers : « Vous ») :
  - **d6** : un vrai cube en 3D qui roule et s'arrête sur la face du résultat ;
  - **d4, d8, d10, d12, d20** : la forme du dé (triangle, losange, cerf-volant, pentagone, hexagone) qui roule en faisant
    défiler des nombres, puis se pose sur le résultat ;
  - **pièce** : elle tourne sur elle-même et retombe sur « Pile » ou « Face ».
- Le dé roule 0,9 s, le résultat reste affiché 2 s, puis le plateau s'efface. Plusieurs dés d'un même lancer roulent
  ensemble (jusqu'à 10) ; deux lancers rapprochés ont chacun leur plateau.
- La ligne d'activité et le journal sont inchangés.
- Mouvement réduit : les dés apparaissent directement sur leur résultat, immobiles.

## Vérifications

`scripts/player-fx-check.mjs` : mode test (vie, clics additionnés, poison, monarque, dés, case coupée, mouvement réduit,
tablette) et en ligne à deux (blessures de commandant, initiative qui passe d'un joueur à l'autre, dés vus par l'autre
joueur, concession : fissures puis écran de victoire chez le gagnant ; rien au rechargement).
