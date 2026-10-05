# Jetons copies depuis les cartes en jeu — plan

**But :** créer depuis le menu clic droit un ou plusieurs jetons copies d'une carte du champ de bataille (la sienne ou celle d'un adversaire).

**Architecture :** aucune règle nouvelle dans le moteur : le menu (`lib/game/menus.ts`) produit des actions `createToken` existantes dont le `TokenData` est construit à partir de la carte affichée (`cardInfo`). Fonctionne en solo et en ligne.

**Design validé par l'utilisateur le 5 octobre (chantier borné, pas de spec séparée).**

## Contraintes

- Entrées du menu d'une carte **visible** sur un champ de bataille (à moi ou à un adversaire) : « Créer un jeton copie » et « Créer des jetons copies… » (question « Combien de jetons ? », valeur proposée 2, de 1 à 20).
- Aucune entrée pour une carte face cachée, pour un spectateur, ni quand la partie est finie (`readOnly`).
- Le jeton est créé sur le champ de bataille **de l'auteur** : à côté de l'original (`x + 4`, `y + 4`, bornés à 0–100) si l'original est chez l'auteur, sinon au centre (50, 50) ; le jeton n°k d'une série est décalé de `+3·k` en x et en y.
- `TokenData` : `name` = nom affiché (face transformée si `flipped`, langue choisie) ; `typeLine` = type affiché ; `image` = image affichée ; `power`/`toughness` = `null` ; `colors` = couleurs de la carte si connues, sinon `[]`. Copier un jeton recopie son `TokenData`.
- Journal : « Crée un jeton <nom> (copie) » — ajouter un champ facultatif `copy?: boolean` à l'action `createToken` (types + `room.ts` qui le laisse passer) et l'utiliser dans le texte du journal.

## Tâche unique

**Fichiers :** `lib/game/types.ts`, `lib/game/apply.ts` (texte du journal), `lib/game/menus.ts`, `lib/game/menus.test.ts`, `lib/game/apply.test.ts` (ou fichier de test existant des jetons), `scripts/playtest-check.mjs`.

- [x] **Étape 1 : tests qui échouent**
  - `menus.test.ts` : carte à moi sur le champ de bataille → les deux entrées présentes ; « Créer un jeton copie » produit `createToken` avec `x = card.x + 4`, `y = card.y + 4`, `copy: true` et le nom/image de la carte ; carte d'un adversaire → entrées présentes, position (50, 50) ; carte face cachée → aucune des deux entrées ; spectateur / `readOnly` → menu vide (inchangé) ; carte transformée → nom et image de la face arrière ; jeton copié → même `TokenData` ; « Créer des jetons copies… » → commande `ask` dont `then(3)` renvoie 3 actions `createToken` décalées de 3 points ; `then(25)` est ramené à 20.
  - `apply` : `createToken` avec `copy: true` → journal « Crée un jeton Forêt (copie) ».
- [x] **Étape 2 :** `npx vitest run lib/game` → échec.
- [x] **Étape 3 :** implémenter.
- [x] **Étape 4 :** `npm test`, `npx tsc --noEmit`, build ; `scripts/playtest-check.mjs` : ajouter le contrôle « clic droit sur une carte du champ de bataille → Créer un jeton copie → un jeton de même nom apparaît » (33 vérifications attendues).
- [x] **Étape 5 : commit** `feat(table): jetons copies depuis les cartes en jeu`, PR qui ferme l'issue.
