# Design — Adaptation tablette de la table

**Date :** 2026-10-06
**Statut :** Validé avec l'utilisateur (issue #81)
**Maquette :** https://claude.ai/artifact/SLrswVXfAH4ezsCXkK2AQj (écran « A sur tablette », 1180 × 820, paysage)
**S'appuie sur :** `2026-10-06-player-column-design.md` (colonne joueur, #80), dont la disposition ne change pas.

---

## Contexte

La table ne sera pas jouée sur téléphone, mais potentiellement sur tablette. La colonne joueur (#80) est pensée pour la souris : boutons −/+ de 20 px, cases de 40 px de haut, boutons de la barre de 28 px, aperçu au survol.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Appareil visé | tablette en **paysage** seulement |
| Tablette en portrait | un message invite à tourner la tablette, à la place de la table |
| Aperçu d'une carte | **dans le menu de la carte**, ouvert par l'appui long : un seul élément à fermer |
| Tailles de référence | **1180 × 820** (maquette) et **1024 × 768** |
| Téléphone | n'est plus une cible : `playtest-mobile-check` (375 × 812) est remplacé par `playtest-tablet-check` |

## Hors périmètre

- Moteur, état de partie et serveur de jeu : **aucun nouveau champ**, compatible avec le serveur de production.
- Contenu des menus et des fenêtres (pile, jetons, Oracle).
- Ordinateur : rien ne change à la souris.

---

## 1. Reconnaître une tablette

La présentation tablette s'applique quand le pointeur principal est le doigt : `@media (pointer: coarse)`. Une variante Tailwind `tablet:` la nomme (et `tablet-portrait:` pour `(pointer: coarse) and (orientation: portrait)`). Un ordinateur à écran tactile utilisé à la souris garde la présentation ordinateur. Aucun calcul en JavaScript : tout est en CSS, donc juste dès le premier affichage.

## 2. Colonne joueur resserrée

| Élément | Ordinateur (#80) | Tablette |
|---|---|---|
| Largeur de la colonne | 216 px | **188 px** |
| Portrait (colonne) | 44 px | **40 px** |
| Vie (colonne) | 52 px | **48 px** |
| −/+ de la vie | petits, dans la ligne portrait | **en grand sous la ligne portrait** : −, + et « ⋯ » sur une rangée, **44 px** de haut |
| Cases Main / Bib. / Cim. / Exil | une rangée de 4 | **deux colonnes, deux rangées**, **44 px** de haut au moins |

- Les bandeaux à 3 à 5 joueurs gardent leur colonne compacte de 184 px (vie 40 px) ; leurs −/+ et « ⋯ » passent aussi en grand sous la ligne portrait, et leurs cases font 44 px de haut (déjà sur deux colonnes).
- Les noms accessibles ne changent pas (« moins : points de vie », « plus : points de vie », « Compteurs de … ») : les contrôles existants les retrouvent.
- Le commandant et le cimetière en cascade restent sous les cases. Quand la hauteur manque (colonne de l'adversaire en haut, surtout en vue agrandie), la cascade se replie d'abord, puis le commandant : la colonne ne déborde jamais sur la mienne. De même, la dernière ligne d'un bandeau (commandement, dernière carte du cimetière) se replie si la barre du haut passe sur deux lignes.

## 3. Barre du haut

Tous les boutons de la barre font **44 px de haut** sur tablette (le texte ne change pas). À 1024 px de large, la barre peut passer sur deux lignes : c'est accepté, la table garde le reste de la hauteur.

## 4. Aperçu dans le menu de carte

- **Pas d'aperçu au survol sur tablette** : l'aperçu flottant (`PreviewPane`, qui apparaissait au toucher) n'est plus affiché. Il ne prend déjà aucune place dans la mise en page ; les champs de bataille gardent toute la largeur.
- **Appui long sur une carte visible** : le menu de la carte s'ouvre avec, à sa gauche, la **grande image de la carte** (224 px de large) et, en haut, un bouton **« Fermer »** de 44 px. Le menu se ferme aussi par un toucher à côté ou par une de ses entrées, comme aujourd'hui.
- L'image vient des mêmes données que l'aperçu (`cardInfo`) : **jamais pour une carte cachée** (dos, face cachée, carte d'un autre en main). Le menu s'ouvre alors sans image.
- Sur une carte sans entrée de menu (spectateur, par exemple), l'appui long ouvre quand même l'aperçu seul, avec « Fermer ».
- Le **clic droit à la souris** ne change pas : menu sans image (l'aperçu au survol reste à l'ordinateur).
- Le menu reste dans l'écran : s'il manque de largeur, l'image passe au-dessus des entrées.

## 5. Tablette en portrait

Sur tablette tenue en portrait, la table est remplacée par un message centré : « Tourne l’écran en paysage pour jouer. » La partie continue (en ligne, rien n'est envoyé au serveur) ; elle réapparaît dès que la tablette est tournée.

Le message parle de l’écran, pas de la tablette : un téléphone tenu droit (hors cible, mais pointeur tactile lui aussi) l’affiche également. En paysage, la table n’y est pas adaptée.

## 6. Vérifications

- `npm test` : tests de l'image du menu (`menuPreview`, jamais pour une carte cachée) et du repère « ouvert au doigt » de l'appui long.
- `npx tsc --noEmit`, `npm run lint`, `npx @cloudflare/next-on-pages`.
- `playtest-check` et `online-check` inchangés à la souris.
- **Nouveau contrôle `scripts/playtest-tablet-check.mjs`**, à 1180 × 820 puis 1024 × 768 (écran tactile émulé) : colonne de 188 px ; −/+ et cases d'au moins 44 px, cases sur deux colonnes ; boutons de la barre d'au moins 44 px ; pas d'aperçu au toucher ; appui long sur une carte de la main : menu avec l'image et « Fermer », dans l'écran ; « Fermer » le ferme ; menu de la bibliothèque ; mulligan par le menu ; en portrait (820 × 1180), le message remplace la table. Il reprend aussi les contrôles de la page du deck (« Oracle et règles » à l'appui long).
- Captures jointes à la PR : mode test en 1180 × 820 et 1024 × 768, menu avec aperçu, message en portrait.
