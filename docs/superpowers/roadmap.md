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
| Import de deck par lien (Moxfield, Archidekt) | design validé en conversation (chantier borné) | — | terminé, à vérifier en production |

## En cours : jeu en ligne à 2–5 joueurs (option B)

Parties libres en Commander, et matchs de ligue en Duel Commander avec score proposé automatiquement puis confirmé.

| # | Sous-projet | Spec | Plan | État |
|---|---|---|---|---|
| 1 | Moteur multijoueur (propriétaire/contrôleur, compteurs, informations cachées, `viewFor`) | `specs/2026-10-04-multiplayer-engine-design.md` | `plans/2026-10-04-multiplayer-engine.md` | **terminé et déployé** (PR #6, mode test migré) |
| 2 | Serveur temps réel (Worker + Durable Object) et salon | `specs/2026-10-04-game-server-lobby-design.md` | `plans/2026-10-04-game-server-lobby.md` | **terminé et déployé** (PR #6 ; partie à plusieurs pas encore testée en vrai) |
| 3 | Interface de table multijoueur | `specs/2026-10-05-online-table-design.md` | `plans/2026-10-05-online-table.md` | **terminé** (vérifié de bout en bout : `scripts/online-check.mjs`, `scripts/playtest-check.mjs` ; PR à ouvrir) |
| 4 | Matchs de ligue en ligne (score proposé, confirmé) | — | — | à faire |

### Décisions déjà prises (jeu en ligne)

- Joueurs de confiance : pas de contrôle de légalité des actions au-delà des droits du moteur ; on vise surtout à ne pas fuiter d'information cachée.
- Commander : 40 PV, blessures de commandant (alerte à 21). Duel Commander : 20 PV, pas de blessures de commandant. Poison mortel à 10.
- Règle 103.8 : à 3 joueurs ou plus, le premier joueur pioche en gardant sa main. Le mulligan est géré par les joueurs : le jeu compte les mulligans mais n'impose aucune carte à mettre au-dessous (décision du 6 octobre, issue #72).
- Une carte d'un adversaire peut être réanimée ou volée ; elle retourne toujours chez son propriétaire en mourant.
- Les identifiants des commandants sont publics (clés de la taxe et des blessures).
- Lancer de dés (issue #99) : pile ou face, d4, d6, d8, d10, d12, d20, jusqu'à 10 dés d'un coup ; tirage par le serveur, résultat public sur la table et au journal ; un lancer ne s'annule pas (sinon on pourrait relancer). Vérifié par `scripts/dice-check.mjs`.

### Points à reprendre dans les sous-projets suivants

- Sous-projet 3 (fait) : mention « (passé par l'hôte) », vraie table à la place de la vue minimale, action `moveTop` pour la carte du dessus.
- Interface pensée pour ordinateur d'abord ; adaptation tablette ensuite.
- Les blessures de commandant retirent aussi des points de vie (choix du moteur) : 3 PV puis 5 blessures → 32 PV.

## Retours de test (5 octobre)

- Connexion, import d'un deck (cartes en français) et mode test : OK, interface fluide.
- **Corrigé — glisser-déposer** : l'aperçu garde la taille de la carte d'origine et la carte se pose au centre de l'aperçu (contrôles ajoutés à `scripts/playtest-check.mjs`).
- **Fait — jetons du deck** (issue #41) : les jetons créés par les cartes (`all_parts` de Scryfall, en français si possible) sont enregistrés à l'import et proposés dans l'onglet « Du deck » de « Créer un jeton » (mode test et partie en ligne, chacun ne voit que les siens). Decks déjà importés : bouton « Mettre à jour les jetons » sur la page du deck.

## Organisation du travail (depuis le 5 octobre)

Chaque tâche est une **issue GitHub** qui cite son plan (`docs/superpowers/plans/`) et ses dépendances ; une IA (ou une session) traite une issue et ouvre une PR qui la ferme. Les consignes communes sont dans `CLAUDE.md`. Cette feuille de route garde la vue d'ensemble.

## Prochains chantiers

1. Import par lien Moxfield / Archidekt — **fait** (Moxfield peut refuser les requêtes du serveur : repli copier-coller affiché).
2. Mot de passe oublié et invitations par mail — **fait** (issues #12 à #15) : spec `specs/2026-10-05-email-accounts-design.md`, plan `plans/2026-10-05-email-accounts.md`. Envoi par Brevo (Resend plus tard), « Mot de passe oublié ? » sur la connexion, adresse dans le profil, invitations par mail ; vérifié par `scripts/mail-check.mjs`. Reste à configurer Brevo en production (`docs/mails.md`).
3. Jetons copies depuis les cartes en jeu — **fait** (clic droit sur une carte visible du champ de bataille, la sienne ou celle d'un adversaire).
4. Sous-projet 4 : matchs de ligue en ligne — conception à faire (issue de conception).
5. Texte Oracle et règles d'une carte (issue #70) — **fait** : fenêtre « Oracle et règles » depuis le menu d'une carte visible en jeu et depuis la liste d'un deck ; règles en cache D1 (`card_rulings`, migration 0009), rafraîchies après 7 jours.
6. Nouvelle mise en page de la table (chantier #22) — **terminé** : spec `specs/2026-10-05-table-layout-design.md`, plan `plans/2026-10-05-table-layout.md` ; plein écran (#35), pastille et bulle des compteurs (#36), piles en vignettes à côté de la main (#37), bandeaux d'adversaires compacts (#38), réglage « Taille des cartes » de 80 % à 150 % (#39).
7. Colonne joueur façon MTGO (chantier #80) — **terminé** : spec `specs/2026-10-06-player-column-design.md`, plan `plans/2026-10-06-player-column.md` ; maquette https://claude.ai/artifact/SLrswVXfAH4ezsCXkK2AQj. Ma colonne avec la vie en gros, rouge à 10 ou moins, cases chiffrées et cimetière en cascade (#83) ; colonne de l'adversaire en Duel (#84) ; colonne compacte à gauche de chaque bandeau, bandeaux sur une rangée et cartes agrandies à 3 à 5 joueurs, même colonne pour l'adversaire agrandi (#85).
8. Adaptation tablette de la table (#81) — chantier suivant ; maquette faite (écran « A sur tablette »), spec et plan à écrire.
9. Plateau d'un adversaire dans une fenêtre à part, en partie en ligne (#82) — après la tablette.

## Idées pour plus tard

- Analyse de deck par IA (courbe de mana, cohérence, suggestions).
- Chat texte et messages rapides pendant la partie (pour l'instant : Discord/WhatsApp).
- Spectateur qui voit tout (option de table).

## Vérifications à faire après déploiement (par l'utilisateur)

- Recherche de jetons sur Scryfall (l'import et les images de cartes sont confirmés).
- Jeu en ligne : tester une vraie partie à plusieurs (second compte ou ami).
- Nouvelle table : vérifier sur son écran (et en Duel comme à 4) la taille des vignettes de piles et le réglage « Taille des cartes » avec les vraies images de cartes.
- Import par lien : essayer un deck Moxfield et un deck Archidekt (le serveur de test n'a pas accès à ces sites).
- Mails : configurer Brevo (`docs/mails.md`), puis un vrai « Mot de passe oublié ? » et une invitation avec adresse.
- Oracle et règles : vérifier que les règles s'affichent (Scryfall non joignable depuis le serveur de test) et que le lien Gatherer mène à la bonne carte, notamment pour `Urza's Saga`, `Kenrith, the Returned King`, `Lim-Dûl the Necromancer`, `Fire // Ice` et une carte recto verso (Gatherer non joignable non plus).
