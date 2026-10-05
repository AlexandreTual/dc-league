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
- Règle 103.8 : à 3 joueurs ou plus, le premier joueur pioche en gardant sa main ; premier mulligan gratuit.
- Une carte d'un adversaire peut être réanimée ou volée ; elle retourne toujours chez son propriétaire en mourant.
- Les identifiants des commandants sont publics (clés de la taxe et des blessures).

### Points à reprendre dans les sous-projets suivants

- Sous-projet 3 (fait) : mention « (passé par l'hôte) », vraie table à la place de la vue minimale, action `moveTop` pour la carte du dessus.
- Interface pensée pour ordinateur d'abord ; adaptation tablette ensuite.
- Les blessures de commandant retirent aussi des points de vie (choix du moteur) : 3 PV puis 5 blessures → 32 PV.

## Retours de test (5 octobre)

- Connexion, import d'un deck (cartes en français) et mode test : OK, interface fluide.
- **Corrigé — glisser-déposer** : l'aperçu garde la taille de la carte d'origine et la carte se pose au centre de l'aperçu (contrôles ajoutés à `scripts/playtest-check.mjs`).
- **À prévoir — jetons du deck** : proposer les jetons créés par les cartes du deck (données `all_parts` de Scryfall), en plus de la recherche actuelle.

## Prochains chantiers (ordre validé le 5 octobre)

1. Import par lien Moxfield / Archidekt — fait (Moxfield peut refuser les requêtes du serveur : repli copier-coller affiché).
2. Mot de passe oublié et invitations par mail (adresse mail des comptes, service d'envoi type Resend) — conception complète à faire.
3. Sous-projet 4 : matchs de ligue en ligne.

## Idées pour plus tard

- Analyse de deck par IA (courbe de mana, cohérence, suggestions).
- Adaptation tablette du mode test et de la table.
- Chat texte et messages rapides pendant la partie (pour l'instant : Discord/WhatsApp).
- Spectateur qui voit tout (option de table).

## Vérifications à faire après déploiement (par l'utilisateur)

- Recherche de jetons sur Scryfall (l'import et les images de cartes sont confirmés).
- Jeu en ligne : tester une vraie partie à plusieurs (second compte ou ami).
- Import par lien : essayer un deck Moxfield et un deck Archidekt (le serveur de test n'a pas accès à ces sites).
