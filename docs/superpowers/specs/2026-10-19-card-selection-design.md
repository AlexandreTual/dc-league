# Sélection de plusieurs cartes à la table — conception

Date : 2026-10-19
Statut : réalisée (issue #178)

## But

Sélectionner plusieurs cartes d'un geste, sur **mon champ de bataille** ou dans **ma main**, puis les déplacer ensemble
sur le champ de bataille ou les ranger d'un coup (cimetière, exil, main, dessus ou dessous de la bibliothèque).
Mode test et partie en ligne. Les cartes d'un adversaire ne sont jamais sélectionnables.

## Gestes

- **Souris** : cliquer-glisser dans le vide de la zone trace un rectangle ; les cartes qu'il touche sont sélectionnées
  (liseré bleu). Maj, Ctrl ou Cmd au départ : le rectangle s'ajoute à la sélection. Maj + clic (ou Ctrl, Cmd) sur une
  carte l'ajoute ou la retire. Clic dans le vide ou Échap : sélection vidée.
- **Tablette** : appui long dans le vide, puis glisser le doigt. Appui long relâché sans glisser dans le vide de la main :
  menu de la main, comme avant (il s'ouvre au lever du doigt). Toucher le vide : sélection vidée.
- **Déplacer** : glisser une carte sélectionnée emporte tout le groupe (l'aperçu affiche le nombre de cartes). Sur mon
  champ de bataille, chaque carte suit le même décalage ; depuis la main, les cartes se posent en rangée autour du point
  visé. Lâché sur ma bibliothèque (Maj : dessous), mon cimetière, mon exil, ma main ou ma zone de commandement : rangé.
- **Menu du groupe** : clic droit ou appui long sur une carte sélectionnée, « N cartes sélectionnées » : Engager,
  Dégager (en jeu), Main ou Champ de bataille (depuis la main, rangée au centre), Cimetière…, Exil, Dessus de la
  bibliothèque…, Dessous de la bibliothèque…, Tout désélectionner.

## Ordre des cartes

Vers la bibliothèque ou le cimetière, la fenêtre « Ordre des cartes » s'ouvre : la première carte finira au-dessus des
autres ; ordre réglé par glisser-déposer ou flèches, puis « Valider cet ordre » ; ou « Ordre aléatoire ». Vers l'exil ou la
main, pas de fenêtre.

## Moteur

Action `moveMany` (`lib/game/types.ts`) : `ids` d'une même zone, dans l'ordre choisi, `zone` de destination (mon champ de
bataille ; ailleurs, la zone du propriétaire de chaque carte, comme pour une carte seule), `position` (dessus ou dessous de
la bibliothèque), `places` (positions sur le champ de bataille), `random` (ordre tiré avec une graine posée par le serveur,
ou par le navigateur en mode test). Mêmes droits que `move`, carte par carte. Une seule ligne de journal et une seule
annulation. Vers une zone cachée (bibliothèque, main), ni nom ni ordre au journal.

Décision (issue #178) : pas de repli vers des `move` successifs pour un serveur de jeu plus ancien. L'aperçu d'une PR
reçoit « Action inconnue » du Worker de production pour un déplacement groupé, sans planter ; tout fonctionne après la fusion.

## Fichiers

- `lib/game/apply.ts`, `lib/game/rules.ts`, `lib/game/validate.ts` : action `moveMany`.
- `lib/game/selection.ts` : sélection (cartes encore là, ajout, retrait), positions d'un groupe, menu du groupe.
- `components/table/lasso.ts` : tracé du rectangle (souris, appui long au doigt).
- `components/table/OrderModal.tsx` : fenêtre « Ordre des cartes ».
- Vérifié par `scripts/selection-check.mjs` (souris, tablette, en ligne).
