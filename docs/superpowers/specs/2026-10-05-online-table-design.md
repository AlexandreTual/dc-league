# Design — Interface de table multijoueur

**Date :** 2026-10-05
**Statut :** Validé
**Projet :** multijoueur en ligne, sous-projet 3/4 (1. moteur → 2. serveur temps réel et salon → **3. interface de table** → 4. matchs de ligue en ligne)

---

## Contexte

Les sous-projets 1 et 2 sont déployés : un moteur multijoueur (`lib/game/`, `viewFor` sans fuite d'information) et un serveur temps réel (Durable Object par table, `lib/game/room.ts`, salon). La partie en ligne s'affiche aujourd'hui dans une vue texte provisoire (`components/online/MinimalGame.tsx`). Le mode test solo (`components/playtest/`) offre déjà une table graphique complète pour un joueur : glisser-déposer, menus clic droit, piles, jetons, journal, raccourcis.

But : jouer de vraies parties à 2–5 sur une table graphique, sans avoir à se dire par Discord qui a quoi en jeu.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Disposition | moi en grand en bas, les adversaires en bandeaux réduits en haut |
| Champ de bataille d'un adversaire en bandeau | rangées triées (créatures / autres permanents / terrains), cartes identiques empilées « ×N » |
| Agrandir un adversaire | il prend la moitié haute avec sa vraie disposition ; les autres en onglets ; glisser-déposer possible entre son plateau et le mien |
| Suivre l'action | journal + carte qui brille + ligne d'activité temporaire + joueur actif en évidence |
| Architecture | une seule table pour le mode test et le jeu en ligne, alimentée par une « source de partie » locale ou distante |
| Écran visé | ordinateur ; la tablette viendra plus tard |

## Hors périmètre

Adaptation tablette ; son ; chat ; jetons propres au deck (`all_parts` de Scryfall) ; spectateur qui voit tout ; matchs de ligue (sous-projet 4).

---

## 1. Moteur (`lib/game/`)

### `moveTop`

```ts
| { type: 'moveTop'; actor: string; to: ZoneRef; position?: Position; x?: number; y?: number; faceDown?: boolean }
```

- Déplace la carte du dessus de la bibliothèque **de l'auteur** ; le moteur la trouve (`players[actor].zones.library[0]`).
- Droits et effets identiques à `move` de cette carte par son propriétaire (destination : son champ de bataille ou ses propres zones ; journal « une carte » vers une zone cachée, nom sinon).
- Refus : bibliothèque vide → « Bibliothèque vide ».
- Le mode test n'a plus besoin de connaître l'identifiant de la carte du dessus (il est retiré de la table).

### Passage de tour par l'hôte

```ts
| { type: 'endTurn'; actor: string; byHost?: boolean }
```

- `byHost: true` ajoute « (passé par l'hôte) » à la ligne « Tour N : nom ». Posé uniquement par `lib/game/room.ts` (commande hôte `passTurn`) ; un `byHost` envoyé par un navigateur est retiré par `serverAction`.

---

## 2. Source de partie (`components/table/source.ts`)

```ts
type GameSource = {
  me: string | null                 // null : spectateur
  view: PlayerView
  catalogs: Record<string, Catalog> // données de cartes connues, par propriétaire
  send(action: ClientAction): void
  undo(): void
  canUndo: boolean
  error: string | null              // dernier refus, effacé après 4 s
  mode: 'local' | 'online'
  online?: { status: 'connecting' | 'open' | 'reconnecting'; host: string; players: string[]; finished: boolean; winner: string | null
             concede(): void; host?: { passTurn(target: string): void; eliminate(target: string): void; close(): void } }
  local?: { deckId: string; deckName: string; newGame(): void
            pendingResume: { turn: number; resume(): void; restart(): void } | null }  // écran « Reprendre la partie (tour N) »
}
```

- **`useLocalSource(catalog, deckName)`** : reprend la logique actuelle de `Playtest.tsx` — `GameHistory` à un joueur `solo`, sauvegarde `localStorage` (version 2), reprise de partie, graines aléatoires du navigateur, « Garder » implicite avant toute action autre que mulligan.
- **`useRemoteSource(tableId)`** : enveloppe `useGameSocket` ; `catalogs` reconstruits depuis les données de cartes reçues (`CardDataMap`).
- `ClientAction` (de `room.ts`) est le type des actions envoyées dans les deux cas ; la source locale y ajoute `actor` et les graines.

---

## 3. Composants (`components/table/`)

Les composants actuels de `components/playtest/` sont déplacés et généralisés ; `Playtest.tsx` et `MinimalGame.tsx` disparaissent.

| Composant | Rôle |
|---|---|
| `Table` | mise en page, contexte de glisser-déposer, menus, fenêtres, raccourcis ; reçoit une `GameSource` |
| `TopBar` | tour, joueur actif, Fin du tour (actif seulement), Piocher, Annuler, Jeton, Journal, FR/EN ; en ligne : Abandonner, menu Hôte ; en solo : Nouvelle partie |
| `MyBoard` | mon champ de bataille, ma main, ma colonne de piles (commandement, bibliothèque, cimetière, exil) |
| `OpponentsArea` | moitié haute : vue « Tous » (bandeaux) ou vue agrandie (un `OpponentBoard` + onglets des autres) ; en Duel, l'adversaire est agrandi d'office |
| `OpponentStrip` | bandeau compact : `PlayerPanel` réduit, main (nombre de dos), bibliothèque (nombre), piles miniatures cliquables, rangées triées |
| `OpponentBoard` | plateau réel d'un adversaire (mêmes zones que `MyBoard`, main en dos de carte), zones acceptant le glisser-déposer |
| `PlayerPanel` | nom, en ligne, hôte, joueur actif, « choisit sa main… », éliminé ; vie, poison, blessures de commandant (Commander), compteurs libres, monarque, initiative |
| `ActivityFeed` | lignes d'activité temporaires et refus en rouge |
| `GameCard`, `Draggable`, `CardMenu`, `PileModal`, `TokenModal`, `LogPanel`, `PreviewPane` | repris du mode test ; `LogPanel` affiche le nom de l'auteur quand il y a plusieurs joueurs |

### Zones et glisser-déposer

- Identifiant de zone : `"<joueur>:<zone>"` (ex. `p2:graveyard`) ; la carte glissée porte son identifiant et sa zone d'origine.
- Dépôt sur un champ de bataille : position calculée sur le centre de l'aperçu (correctif du 5 octobre conservé).
- Glisser la pile de **ma** bibliothèque envoie `moveTop` ; celle d'un adversaire ne se glisse pas.
- Le moteur reste juge : un dépôt refusé affiche le message dans `ActivityFeed`.

### Menus clic droit (`lib/game/menus.ts`, pur)

`cardMenu(ctx): MenuEntry[]` avec `ctx = { me, card (VisibleCard), zone: ZoneRef, view, format }` ; chaque entrée porte un libellé et une `ClientAction` (ou une commande d'interface : ouvrir une fenêtre, demander un nombre).

| Carte | Entrées |
|---|---|
| à moi, sur mon champ de bataille | celles du mode test + « Donner le contrôle à … » (un par adversaire) |
| d'un autre, sur son champ de bataille | Engager/Dégager, marqueurs, « Prendre le contrôle », « Dans son cimetière / son exil / sa main » |
| dans le cimetière ou l'exil d'un autre | « Sur mon champ de bataille », « Dans sa main / son exil / son cimetière » |
| dans ma main | « Révéler à tous », « Révéler à … » (un par joueur), destinations du mode test |
| pile de ma bibliothèque | menu du mode test + « Jouer avec la carte du dessus révélée » |
| pile de la bibliothèque d'un autre | « Regarder les X du dessus… », « Chercher… » (fenêtre de pile ; fermeture = `endLook`) |
| spectateur ou partie finie | aucun menu |

Menu de la main : « Révéler ma main ».

### Rangées triées (`lib/game/battlefield.ts`, pur)

`groupBattlefield(cards: CardView[], catalogs): { creatures: Stack[]; others: Stack[]; lands: Stack[] }`, `Stack = { cards: VisibleCard[]; count: number }`.

- Type lu sur la face visible (`cardInfo`) : contient « Creature » → créatures ; sinon « Land » → terrains ; sinon autres. Jeton : d'après sa ligne de type. Carte face cachée : « autres », affichée en dos.
- Empilement : même propriétaire, même `ref` (ou même jeton), même état (`tapped`, `flipped`, `faceDown`, marqueurs).
- Ordre : ordre d'arrivée sur le champ de bataille.

### Repères d'activité (`lib/game/activity.ts`, pur)

`diffViews(prev: PlayerView | null, next: PlayerView, me: string | null): { changed: string[]; lines: { actor: string; text: string }[] }`

- `changed` : identifiants des cartes visibles dans `next` dont la zone, `tapped`, `flipped`, `faceDown` ou les marqueurs diffèrent de `prev` (ou absentes de `prev`).
- `lines` : entrées du journal ajoutées entre `prev` et `next` dont l'auteur n'est pas `me`.
- `prev = null` (connexion, reconnexion) : rien.
- Affichage : cartes `changed` en surbrillance 1,5 s ; lignes 4 s chacune, 3 au maximum à l'écran.

---

## 4. Disposition

- Hauteurs : barre ≈ 48 px ; adversaires ≈ 42 % ; moi ≈ 58 %.
- Vue « Tous » : 1 adversaire → agrandi ; 2 → deux bandeaux pleine largeur ; 3–4 → grille de deux colonnes.
- Vue agrandie : clic sur le nom d'un bandeau ; onglets des autres (nom, vie) ; bouton « Tous ».
- Spectateur : moitié basse remplacée par les bandeaux restants (tous les joueurs visibles), bandeau « Tu regardes cette partie ».
- Fin : bandeau « Victoire de X » / « Partie close », table en lecture seule.

---

## 5. Erreurs

- Refus du moteur ou du serveur → `ActivityFeed`, en rouge, 4 s.
- Connexion perdue → bandeau « Reconnexion… », actions désactivées.
- Mode test : sauvegarde, reprise et annulation inchangées.

---

## 6. Tests

- **Unitaires** : `moveTop` (dessus pris, refus si vide, face cachée, journal), `endTurn byHost` (mention au journal, `byHost` du navigateur ignoré par `room.ts`) ; `groupBattlefield` (classement, empilement, face cachée, jeton) ; `diffViews` (zone, engagement, marqueurs, nouvelles lignes, ses propres actions exclues, première vue vide) ; `cardMenu` (chaque ligne du tableau des menus, spectateur sans menu).
- **Navigateur, mode test** : `scripts/playtest-check.mjs` (32 vérifications) passe sur la nouvelle table, attentes inchangées ; seuls des sélecteurs peuvent changer.
- **Navigateur, en ligne** : `scripts/online-check.mjs` réécrit pour la table — 3 joueurs + 1 spectateur : rangées de Bastien visibles chez Ana ; carte jouée par Bastien en surbrillance et ligne d'activité chez Ana ; Bastien agrandit Ana et glisse une carte de son cimetière vers son champ de bataille ; Chloé retire 3 PV à Ana et ajoute 5 blessures de commandant, vu par tous ; Ana regarde les 3 du dessus de Bastien (aucune donnée de ces cartes chez Chloé ni le spectateur) ; glisser de sa propre bibliothèque vers son champ de bataille (`moveTop`) ; spectateur sans menu ; l'hôte passe le tour de Chloé (« (passé par l'hôte) ») ; abandon, élimination, bandeau de victoire ; aucune erreur JavaScript.
- **Captures** : vue « Tous » à 4, vue agrandie, Duel, mode test.

## Fichiers

- Créer : `components/table/*`, `lib/game/menus.ts`, `lib/game/battlefield.ts`, `lib/game/activity.ts` et leurs tests.
- Modifier : `lib/game/types.ts`, `rules.ts`, `apply.ts` (`moveTop`, `byHost`), `lib/game/room.ts` (`passTurn` avec `byHost`), `app/decks/[id]/test/page.tsx`, `components/online/TableView.tsx`, `scripts/playtest-check.mjs` (sélecteurs), `scripts/online-check.mjs`, `docs/superpowers/roadmap.md`.
- Supprimer : `components/playtest/*` (déplacés), `components/online/MinimalGame.tsx`.
