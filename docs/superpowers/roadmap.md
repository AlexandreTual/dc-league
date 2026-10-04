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

## En cours : jeu en ligne à 2–5 joueurs (option B)

Parties libres en Commander, et matchs de ligue en Duel Commander avec score proposé automatiquement puis confirmé.

| # | Sous-projet | Spec | Plan | État |
|---|---|---|---|---|
| 1 | Moteur multijoueur (propriétaire/contrôleur, compteurs, informations cachées, `viewFor`) | `specs/2026-10-04-multiplayer-engine-design.md` | `plans/2026-10-04-multiplayer-engine.md` | **terminé** (branche `ccr-c25fefc0-vailvt`, mode test migré) |
| 2 | Serveur temps réel (Worker + Durable Object) et salon | `specs/2026-10-04-game-server-lobby-design.md` | `plans/2026-10-04-game-server-lobby.md` | **terminé** (vérifié de bout en bout en local ; à déployer) |
| 3 | Interface de table multijoueur | — | — | à faire |
| 4 | Matchs de ligue en ligne (score proposé, confirmé) | — | — | à faire |

### Décisions déjà prises (jeu en ligne)

- Joueurs de confiance : pas de contrôle de légalité des actions au-delà des droits du moteur ; on vise surtout à ne pas fuiter d'information cachée.
- Commander : 40 PV, blessures de commandant (alerte à 21). Duel Commander : 20 PV, pas de blessures de commandant. Poison mortel à 10.
- Règle 103.8 : à 3 joueurs ou plus, le premier joueur pioche en gardant sa main ; premier mulligan gratuit.
- Une carte d'un adversaire peut être réanimée ou volée ; elle retourne toujours chez son propriétaire en mourant.
- Les identifiants des commandants sont publics (clés de la taxe et des blessures).

### Points à reprendre dans les sous-projets suivants

- **Sous-projet 3** : quand l'hôte passe le tour d'un absent, le journal l'attribue à l'absent (« Chloé : Tour 1 : Ana ») ; préciser « (passé par l'hôte) ».
- **Sous-projet 3** : la vue de jeu minimale (`components/online/MinimalGame.tsx`) est à remplacer par la vraie table.
- **Sous-projet 3** : action « déplacer la carte du dessus de sa bibliothèque » (en ligne, le client ne connaît pas l'identifiant de la carte du dessus ; le mode test solo, lui, le connaît localement).
- **Sous-projet 3** : interface pensée pour ordinateur d'abord, adaptation tablette envisagée ensuite.

## Idées pour plus tard

- Analyse de deck par IA (courbe de mana, cohérence, suggestions).
- Adaptation tablette du mode test et de la table.
- Chat texte et messages rapides pendant la partie (pour l'instant : Discord/WhatsApp).
- Spectateur qui voit tout (option de table).

## Vérifications à faire après déploiement (par l'utilisateur)

- Migrations D1 0002 et 0003 appliquées sur la base distante.
- Import réel depuis Scryfall (bloqué dans l'environnement de développement), recherche de jetons, vraies images de cartes.
- Jeu en ligne : secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`, premier déploiement du Worker, puis relance du déploiement Pages (`docs/deploiement-jeu-en-ligne.md`).
