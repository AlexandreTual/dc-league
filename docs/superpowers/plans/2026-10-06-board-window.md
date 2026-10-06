# Plateau d'un adversaire dans une fenêtre à part — plan

**Spec :** `docs/superpowers/specs/2026-10-06-board-window-design.md` (issue #82). Une seule tâche, une PR.

**Fichiers :**
- Créer : `components/table/boardWindows.ts` (messages, adresses, expiration, module pur) et `boardWindows.test.ts`
- Créer : `components/table/useBoardWindows.ts` (`useBoardWindows` côté table, `useBoardWindowAnnounce` côté fenêtre)
- Créer : `app/tables/[id]/plateau/[joueur]/page.tsx`, `components/online/BoardWindow.tsx`
- Modifier : `components/table/source.ts` et `useRemoteSource.ts` (`online.tableId`)
- Modifier : `components/table/PlayerPortrait.tsx` (`onDetach` : icône et ligne de la bulle)
- Modifier : `components/table/Table.tsx` (prop `boardWindow`, plateaux sortis retirés, bandeaux « Ramener » et « fenêtre bloquée »)
- Créer : `scripts/board-window-check.mjs` (contrôle navigateur)

- [x] Étape 1 : tests du module pur (adresses, messages, expiration à 5 s), puis le module.
- [x] Étape 2 : hooks, page de la fenêtre, boutons et table.
- [x] Étape 3 : `scripts/board-window-check.mjs` : ouverture, contenu, suivi en direct, menu, vie, fuite de cartes cachées, « Ramener » des deux côtés, fermeture, deux fenêtres, rechargement, fenêtre bloquée, adresse invalide, tablette sans bouton.
- [x] Étape 4 : `npm test`, `npx tsc --noEmit`, `npm run lint`, build, `online-check`, `playtest-check`, `playtest-mobile-check`.
