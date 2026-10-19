# Feuille de route — Commander League

Document de référence : où en est le projet, ce qui reste à faire, et les décisions prises en chemin.
À mettre à jour à chaque sous-projet terminé ou décision importante.

Méthode pour chaque sous-projet : conception (spec validée) → plan → exécution tâche par tâche (tests d'abord) → vérification → pull request.

---

## Terminé

| Projet | Spec | Plan | État |
|---|---|---|---|
| Historique de la ligue | `specs/2026-04-30-league-history-design.md` | `plans/2026-04-30-league-history.md` | fusionné |
| Inscriptions et decks de ligue | `specs/design-league-enrollment-decks.md` | `plans/2026-05-01-league-enrollment-decks.md` | fusionné |
| Comptes joueurs | `specs/2026-10-03-player-accounts-design.md` | `plans/2026-10-03-player-accounts.md` | fusionné (PR #5) |
| Import de decks (Scryfall, cartes en français) | `specs/2026-10-04-deck-import-design.md` | `plans/2026-10-04-deck-import.md` | fusionné (PR #5) |
| Mode test solo (type Moxfield) | `specs/2026-10-04-playtest-design.md` | `plans/2026-10-04-playtest.md` | fusionné (PR #5) |
| Import de deck par lien (Moxfield, Archidekt) | design validé en conversation (chantier borné) | — | terminé, vérifié en production |

## En cours : jeu en ligne à 2–5 joueurs (option B)

Parties libres en Commander, et matchs de ligue en Duel Commander avec score proposé automatiquement puis confirmé.

| # | Sous-projet | Spec | Plan | État |
|---|---|---|---|---|
| 1 | Moteur multijoueur (propriétaire/contrôleur, compteurs, informations cachées, `viewFor`) | `specs/2026-10-04-multiplayer-engine-design.md` | `plans/2026-10-04-multiplayer-engine.md` | **terminé et déployé** (PR #6, mode test migré) |
| 2 | Serveur temps réel (Worker + Durable Object) et salon | `specs/2026-10-04-game-server-lobby-design.md` | `plans/2026-10-04-game-server-lobby.md` | **terminé et déployé** (PR #6 ; partie à plusieurs pas encore testée en vrai) |
| 3 | Interface de table multijoueur | `specs/2026-10-05-online-table-design.md` | `plans/2026-10-05-online-table.md` | **terminé et déployé** (vérifié de bout en bout : `scripts/online-check.mjs`, `scripts/playtest-check.mjs`) |
| 4 | Matchs de ligue en ligne (score proposé, confirmé) | — | — | repris dans la refonte des ligues, partie 3 (#125) |

### Décisions déjà prises (jeu en ligne)

- Joueurs de confiance : pas de contrôle de légalité des actions au-delà des droits du moteur ; on vise surtout à ne pas fuiter d'information cachée.
- Commander : 40 PV, blessures de commandant (alerte à 21). Duel Commander : 20 PV, pas de blessures de commandant. Poison mortel à 10.
- Règle 103.8 : à 3 joueurs ou plus, le premier joueur pioche en gardant sa main. Le mulligan est géré par les joueurs : le jeu compte les mulligans mais n'impose aucune carte à mettre au-dessous (décision du 6 octobre, issue #72).
- Une carte d'un adversaire peut être réanimée ou volée ; elle retourne toujours chez son propriétaire en mourant.
- Les identifiants des commandants sont publics (clés de la taxe et des blessures).
- Lancer de dés (issue #99) : pile ou face, d4, d6, d8, d10, d12, d20, jusqu'à 10 dés d'un coup ; tirage par le serveur, résultat public sur la table et au journal ; un lancer ne s'annule pas (sinon on pourrait relancer). Vérifié par `scripts/dice-check.mjs`.
- Qui commence (issue #100) : le serveur tire l'ordre du tour au hasard, sauf si l'hôte choisit le premier joueur dans la salle d'attente (les autres places restent tirées). Au lancement, chaque joueur voit les noms défiler jusqu'au premier joueur (sans défilement s'il a été choisi), puis l'ordre du tour ; un numéro d'ordre reste affiché à côté de chaque nom. Rien en mode test. Vérifié par `scripts/first-player-check.mjs`.

### Points à reprendre dans les sous-projets suivants

- Sous-projet 3 (fait) : mention « (passé par l'hôte) », vraie table à la place de la vue minimale, action `moveTop` pour la carte du dessus.
- Interface pensée pour ordinateur d'abord ; adaptation tablette faite (#81).
- Les blessures de commandant retirent aussi des points de vie (choix du moteur) : 3 PV puis 5 blessures → 32 PV.

## Retours de test (5 octobre)

- Connexion, import d'un deck (cartes en français) et mode test : OK, interface fluide.
- **Corrigé — glisser-déposer** : l'aperçu garde la taille de la carte d'origine et la carte se pose au centre de l'aperçu (contrôles ajoutés à `scripts/playtest-check.mjs`).
- **Fait — jetons du deck** (issue #41) : les jetons créés par les cartes (`all_parts` de Scryfall, en français si possible) sont enregistrés à l'import et proposés dans l'onglet « Du deck » de « Créer un jeton » (mode test et partie en ligne, chacun ne voit que les siens). Decks déjà importés : bouton « Mettre à jour les jetons » sur la page du deck.

## Organisation du travail (depuis le 5 octobre)

Chaque tâche est une **issue GitHub** qui cite son plan (`docs/superpowers/plans/`) et ses dépendances ; une IA (ou une session) traite une issue et ouvre une PR qui la ferme. Les consignes communes sont dans `CLAUDE.md`. Cette feuille de route garde la vue d'ensemble.

## Prochains chantiers

1. Import par lien Moxfield / Archidekt — **fait** (Moxfield peut refuser les requêtes du serveur : repli copier-coller affiché). Import en un clic : on crée le deck avec son nom et son lien (« Créer et importer »), la liste est lue puis complétée par Scryfall et enregistrée sans autre étape ; pour mettre à jour la liste, bouton « Réimporter » sur la page du deck (zone de collage si le deck n’a pas de lien).
2. Mot de passe oublié et invitations par mail — **fait** (issues #12 à #15) : spec `specs/2026-10-05-email-accounts-design.md`, plan `plans/2026-10-05-email-accounts.md`. Envoi depuis la Gmail de l'admin par un script Google Apps Script (Brevo abandonné : validation par SMS impossible ; Resend plus tard), « Mot de passe oublié ? » sur la connexion, adresse dans le profil, invitations par mail ; vérifié par `scripts/mail-check.mjs`. Script Google configuré en production.
3. Jetons copies depuis les cartes en jeu — **fait** (clic droit sur une carte visible du champ de bataille, la sienne ou celle d'un adversaire).
4. Sous-projet 4 : matchs de ligue en ligne — repris dans la refonte des ligues (#117, partie 3 : #125).
5. Texte Oracle et règles d'une carte (issue #70) — **fait** : fenêtre « Oracle et règles » depuis le menu d'une carte visible en jeu et depuis la liste d'un deck ; règles en cache D1 (`card_rulings`, migration 0009), rafraîchies après 7 jours.
6. Nouvelle mise en page de la table (chantier #22) — **terminé** : spec `specs/2026-10-05-table-layout-design.md`, plan `plans/2026-10-05-table-layout.md` ; plein écran (#35), pastille et bulle des compteurs (#36), piles en vignettes à côté de la main (#37), bandeaux d'adversaires compacts (#38), réglage « Taille des cartes » de 80 % à 150 % (#39).
7. Colonne joueur façon MTGO (chantier #80) — **terminé** : spec `specs/2026-10-06-player-column-design.md`, plan `plans/2026-10-06-player-column.md` ; maquette https://claude.ai/artifact/SLrswVXfAH4ezsCXkK2AQj. Ma colonne avec la vie en gros, rouge à 10 ou moins, cases chiffrées et cimetière en cascade (#83) ; colonne de l'adversaire en Duel (#84) ; colonne compacte à gauche de chaque bandeau, bandeaux sur une rangée et cartes agrandies à 3 à 5 joueurs, même colonne pour l'adversaire agrandi (#85).
8. Adaptation tablette de la table (#81) — **terminé** : spec `specs/2026-10-06-tablet-design.md`, plan `plans/2026-10-06-tablet.md`. Tablette en paysage (1180 × 820, 1024 × 768) : colonne de 188 px, −/+ et cases de 44 px, barre du haut en 44 px, aperçu de la carte dans le menu ouvert par l'appui long (bouton « Fermer »), message « Tourne l’écran » en portrait. Avec les piles à côté de la main (par défaut), seule la bibliothèque y reste ; cimetière, exil et commandement sont dans un menu juste au-dessus, ouvert aussi pendant un glisser. Le téléphone n'est plus une cible (`playtest-tablet-check` remplace `playtest-mobile-check`).
9. Plateau d'un adversaire dans une fenêtre à part, en partie en ligne (#82) — **fait** : spec `specs/2026-10-06-board-window-design.md`, plan `plans/2026-10-06-board-window.md` ; bouton « Ouvrir dans une fenêtre » sur ordinateur (ligne portrait et bulle « ⋯ » de chaque adversaire), une fenêtre par adversaire (`/tables/<id>/plateau/<joueur>`), « Ramener » des deux côtés ; traité avant la tablette, indépendante.
10. Vrai plein écran du navigateur (#91) — **fait** : bouton « Plein écran » / « Quitter le plein écran » dans la barre de la table (mode test et en ligne), API Fullscreen, suit Échap ; message si le navigateur refuse (iPhone notamment).
11. Force et endurance modifiables sur la carte (#110) — **fait** : encart en bas à droite de chaque carte en jeu (imprimée, 2/2 face cachée, + marqueurs + modification ; vert / rouge), toucher l'encart pour la modifier (− / +, saisie directe, « Réinitialiser »), aussi dans le menu de la carte ; tout joueur peut modifier ; remise à zéro en quittant le champ de bataille (en fin de tour : seulement l'écart « ce tour », voir 21). Force et endurance enregistrées à l'import (migration 0012), rattrapées chez Scryfall pour les decks déjà importés à l'ouverture du mode test ou au lancement d'une partie.
12. Nouvelle page d'accueil et navigation (proposition du 10 octobre, PR à examiner) — l'accueil présente le site (saison en cours avec avancement et podium, rubriques : ligue, decks, mode test, parties en ligne, statistiques, règles ; rubriques réservées menant à la connexion pour un visiteur). Le classement passe sur `/classement`. Barre du haut réduite à « Ligue · Jouer · Mes decks · Règles » (`lib/nav.ts`) ; classement, calendrier, playoffs, statistiques et historique deviennent des onglets de « Ligue » (« Playoffs » seulement une fois la phase finale lancée) ; l'administration passe dans le menu du compte. Vérifié par `scripts/home-nav-check.mjs` et `scripts/mobile-check.mjs`.
13. Marqueurs du joueur en liste, façon Moxfield (#128) — **fait** : la bulle « ⋯ » du portrait liste une ligne par marqueur (icône, nom, valeur, − et +, Maj : ±5) : poison, une ligne par commandant adverse connu, Énergie, Expérience, Rad et Tickets toujours listés, puis les marqueurs libres ; champ « Nouveau marqueur… » en bas (Entrée ou +, créé à 1, doublon refusé sans tenir compte de la casse ni des accents) ; Monarque et Initiative en interrupteurs ; boutons de 44 px sur tablette ; la bulle s'ouvre du côté où elle tient. Badges sous le portrait inchangés.
14. Loyauté des planeswalkers modifiable sur la carte — **fait** : même principe que la force et l'endurance. Encart en bas à droite d'un planeswalker en jeu (loyauté imprimée, du verso une fois transformé, + marqueurs ajoutés ou retirés ; vert / rouge ; jamais sous 0), toucher l'encart pour la modifier (− / +, saisie directe, « Réinitialiser la loyauté »), aussi « Loyauté » dans le menu de la carte ; tout joueur peut modifier ; remise à zéro en quittant le champ de bataille. Loyauté enregistrée à l'import (migration 0014), rattrapée chez Scryfall pour les decks déjà importés comme la force et l'endurance. Vérifié par `scripts/loyalty-check.mjs`.
15. Assistant IA pour les cartes (#137) — **fait** : spec `specs/2026-10-13-ai-card-assistant-design.md`, plan `plans/2026-10-13-ai-card-assistant.md` (#138 à #143, plus #148). Google Gemini en offre gratuite (`gemini-flash-latest` par défaut, `GEMINI_MODEL` pour changer), 20 questions par joueur et par jour (jour de Paris), joueurs connectés seulement. L'IA reçoit le texte Oracle, le texte français et les règles des cartes, et répond en français dans un panneau de chat ; ouvert depuis la fiche « Oracle et règles » (« Demander à l'IA »), la page d'un deck (« Assistant IA ») et le menu d'une carte visible à la table (« Ajouter à la question IA »). Interrupteur et utilisation du jour dans l'administration. Guide de la clé : `docs/assistant-ia.md`. Vérifié par `scripts/ai-check.mjs` (faux Gemini).
16. Parties en cours dans l'administration — **fait** : section « Parties en cours » (tables non terminées, les plus inactives d'abord, inactivité au-delà de 24 h signalée). Un admin supprime une partie abandonnée (partie du serveur de jeu puis table, joueurs connectés prévenus « Cette partie n'existe plus ») ou toutes celles inactives depuis plus de 24 h. Même suppression que le nettoyage de nuit (`lib/games/remove.ts`). Vérifié par `scripts/admin-games-check.mjs`.
17. Minuteur des parties en ligne (issue #101) — **fait** : temps de partie et temps du tour en cours dans la barre du haut (heure du serveur, mêmes valeurs pour tous) ; à la fin, durée figée et enregistrée (`game_tables.duration_seconds`) avec le temps de jeu de chaque joueur pendant ses tours (`game_seats.play_seconds`, migration 0017) pour des statistiques plus tard. Décisions du 7 octobre : pistes A et B seulement (pas de pendule ni de limite de partie), pas de pause, rien en mode test.
18. Animations et capacités des cartes en jeu (#173) — **terminé** : spec `specs/2026-10-19-card-animations-design.md`, maquette https://claude.ai/artifact/AvkfDG78QDPF448bsiXiwn. Étape 1 **faite** : liseré doré sur les permanents légendaires en jeu, et éclat qui les traverse une seule fois à leur arrivée en jeu, chez tous les joueurs (mode test, en ligne, bandeaux, fenêtre à part ; un reflet toutes les 7 s a été écarté car il déconcentrait), case « Animations des cartes » dans les réglages de la table, liseré seul en mouvement réduit ; vérifié par `scripts/card-effects-check.mjs`. Étape 2 **faite** : les créatures avec le vol imprimé flottent au-dessus de leur ombre, se posent une fois engagées (cartes, jetons du deck, jetons cherchés, copies) ; capacités imprimées enregistrées à l'import (migration 0018, colonne `keywords` de `cards` et `deck_tokens`), rattrapées chez Scryfall pour les cartes déjà importées ; jetons des decks importés avant : au prochain « Réimporter ». Étape 3 **faite** : « Donner une capacité… » dans le menu d'une carte en jeu (la sienne ou celle d'un adversaire) ouvre la fenêtre « Capacités » (15 capacités, imprimées cochées ; décocher une imprimée la marque perdue ; durée « Tout le temps » ou « Jusqu'à la fin du tour ») ; capacités données ou perdues en symboles sur le bord gauche ou en libellés (réglage « Capacités sur les cartes »), en toutes lettres dans l'aperçu ; journal « donne Piétinement à … » ; effacées en quittant le champ de bataille ; le vol donné fait flotter, perdu arrête le flottement. Vérifié par `scripts/abilities-check.mjs`. Suite (#177) **faite** : capacités à paramètre dans la même fenêtre, Protection (couleurs ou « Tout ») et Parade (coût libre, raccourcis {1} à {4}), spec `specs/2026-10-19-ability-parameters-design.md`. Ajout : entrée remarquable du commandant qui arrive en jeu (il se pose, halo, deux ondes dorées, couronne ; couronne seule en mouvement réduit), vérifiée par `scripts/card-effects-check.mjs`. Suite **faite** : 43 capacités en quatre groupes (Courantes, Évasion, Combat et retour, Avec une valeur), dont les traversées des cinq terrains de base et les capacités chiffrées (Annihilateur, Toxique, Affliction, Bushido, Après-vie, Absorption ; nombre de 1 à 99).
19. Permanents hors phase — **terminé** : spec `specs/2026-10-19-phasing-design.md`. « Passer hors phase » / « Revenir en phase » dans le menu d'une carte en jeu (la sienne ou celle d'un adversaire) ; carte estompée avec la mention « Hors phase », qui garde son état ; retour en phase automatique au début du tour de son contrôleur, avant de dégager ; journal. Vérifié par `scripts/phasing-check.mjs`.
20. Sélection de plusieurs cartes à la table (#178) — **fait** : spec `specs/2026-10-19-card-selection-design.md`. Rectangle tracé dans le vide de mon champ de bataille ou de ma main (souris ; appui long puis glisser sur tablette), Maj + clic pour ajouter ou retirer, Échap ou clic dans le vide pour vider. Le groupe se déplace ensemble ou se range d'un coup (glisser sur une pile, ou menu du groupe : engager, dégager, main, cimetière, exil, dessus ou dessous de la bibliothèque) ; vers la bibliothèque ou le cimetière, ordre choisi ou aléatoire (tiré par le serveur). Nouvelle action `moveMany` : une ligne de journal, une annulation. Vérifié par `scripts/selection-check.mjs`.
21. Force/endurance jusqu'à la fin du tour et effets sur plusieurs créatures — **fait** : spec `specs/2026-10-19-end-of-turn-effects-design.md`. Lignes « Force ce tour » / « Endurance ce tour » dans l'encart et le menu de la carte (effacées au passage du tour, encart en pointillés) ; fenêtre « Effet » (force, endurance, capacités, durée « Jusqu'à la fin du tour » par défaut) depuis « Effet sur toutes mes créatures… » ou « Effet sur la sélection… » (Finale of Devastation : +X/+X et Célérité) ; nouvelles actions `ptTurn` et `effect` (une ligne de journal, une annulation). Vérifié par `scripts/effect-check.mjs`.

## Refonte des ligues (chantier #117, 12 octobre)

Tout compte joueur crée et gère sa ligue, plusieurs ligues en parallèle ; ensuite scores saisis par les joueurs et matchs en ligne en BO3.

| # | Partie | Spec | Plan | État |
|---|---|---|---|---|
| 1 | Plusieurs ligues gérées par leur organisateur (publique ou privée, lien d'invitation) | `specs/2026-10-12-user-leagues-design.md` | `plans/2026-10-12-user-leagues.md` | **fait** (#118 à #122), vérifié par `scripts/leagues-check.mjs` |
| 1 bis | Rondes suisses pour les ligues nombreuses | — | — | conception à faire (#123) |
| 2 | Scores saisis par les joueurs, match en physique ou en ligne | — | — | conception à faire (#124, reprend #51) |
| 3 | Match de ligue en ligne en BO3, score inscrit à la fin | — | — | conception à faire (#125, ex-sous-projet 4) |

Décisions : il faut déjà un compte pour rejoindre une ligue (le site reste sur invitation de l'admin) ; une ligue privée répond « introuvable » à qui n'y est pas ; le créateur est inscrit d'office ; les statistiques ne comptent que les ligues publiques ; les ligues d'avant la refonte sont publiques et gérées par les admins ; `/classement`, `/calendar`, `/playoffs`, `/history`, `/stats` redirigent.

## Idées pour plus tard

- Analyse de deck par IA (courbe de mana, cohérence, suggestions).
- Chat texte et messages rapides pendant la partie (pour l'instant : Discord/WhatsApp).
- Spectateur qui voit tout (option de table).

## Vérifications à faire après déploiement (par l'utilisateur)

- Decks : une carte d'une édition sans version française (Secret Lair, sans bordure, *showcase*…) affiche le visuel du deck papier, avec le nom et le texte en français (#158). L'image du commandant dans la liste des decks change au prochain réimport.
- Jeu en ligne : jouer une vraie partie à plusieurs, avec des amis (une partie avec de faux comptes fonctionne).

Vérifié en production le 14 octobre : assistant IA (réponses justes), Oracle et règles, import par lien Moxfield et Archidekt, réimport, jetons du deck, force, endurance et loyauté (tous les decks ont été réimportés, il n'y a plus d'ancien deck), ainsi que le reste de la liste précédente. Le plein écran sur iPhone et Android ne sera pas testé : le téléphone n'est pas une cible.
