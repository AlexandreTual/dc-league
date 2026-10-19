# Capacités à paramètre (Protection, Parade) — conception

Date : 2026-10-19
Statut : réalisée pour Protection et Parade (issue #177), puis pour les capacités chiffrées et 20 capacités sans paramètre (voir « Capacités ajoutées » à la fin)
Suite de : `specs/2026-10-19-card-animations-design.md` (« Donner une capacité… », issue #173)

## But

Donner, depuis la fenêtre « Capacités », des capacités qui ont besoin d'une précision. La mécanique est mise en place avec
deux capacités :

- **Protection** contre une ou plusieurs couleurs, ou contre tout (« protection contre le rouge ») ;
- **Parade** avec son coût (Ward en anglais : « Parade {2} », « Parade — Payez 3 points de vie »).

Les autres capacités à paramètre (Toxique, Annihilateur, traversée des forêts…) seront ajoutées ensuite sur le même modèle,
une fois leur nom français vérifié sur une carte imprimée.

## Paramètres

| Capacité | Scryfall | Paramètre | Exemple affiché |
|---|---|---|---|
| Protection | Protection | couleurs parmi blanc, bleu, noir, rouge, vert (au moins une), ou « tout » | Protection contre le rouge et le vert |
| Parade | Ward | coût en texte libre, 40 caractères au plus (« {2} », « — Payez 3 points de vie ») | Parade {2} |

- Une seule Protection par permanent : plusieurs couleurs se cochent ensemble (« contre le rouge et le bleu »).
- Une seule Parade par permanent.
- Protection contre autre chose qu'une couleur (« contre les créatures », « contre les Démons ») : hors champ pour
  l'instant.

## Fenêtre « Capacités »

- Protection et Parade sont deux lignes de plus dans la liste.
- Une fois la case cochée, le choix du paramètre apparaît sous la ligne :
  - **Protection** : cinq pastilles de couleur (W, U, B, R, G) et une pastille « Tout », à cocher ;
  - **Parade** : un champ de coût, prérempli avec « {2} », et des raccourcis {1} {2} {3} {4}.
- « Valider » reste grisé tant que Protection est cochée sans couleur ni « Tout », ou que Parade est cochée sans coût.
- On peut modifier le paramètre d'une capacité déjà donnée : rouvrir la fenêtre, changer les couleurs ou le coût, valider.
- La durée (« Tout le temps » ou « Jusqu'à la fin du tour ») vaut aussi pour ces capacités.
- **Capacité imprimée** (une carte avec Protection ou Parade écrite dessus) : la ligne est cochée et marquée « (imprimée) ».
  Décocher la marque perdue, comme les autres. Son paramètre imprimé n'est pas repris pour l'instant.

## Sur la carte, dans l'aperçu et au journal

- **Symboles** : un bouclier pour Protection, avec de petites pastilles des couleurs choisies (ou « ∞ » pour « Tout ») ;
  une main levée pour Parade, avec son coût en petit (« 2 »).
- **Libellés** : « Protection » suivi des pastilles de couleur (placées juste après l'icône, pour rester visibles si le
  libellé est coupé), « Parade {2} ».
- **Aperçu** : « Capacités données : Protection contre le rouge et le vert, Parade {2} ».
- **Journal** : « donne Protection contre le rouge à Llanowar Elves », « donne Parade {2} à Llanowar Elves ». Un paramètre
  modifié : « change Protection de Llanowar Elves : contre le bleu ».
- Pastilles en pointillés si la capacité dure jusqu'à la fin du tour ; rouge barré si elle est imprimée et perdue.

## Moteur de partie

- `KEYWORDS` reçoit `Protection` et `Ward`.
- `GainedAbility` reçoit `param?: string`. Il est obligatoire pour ces deux capacités et absent pour les autres :
  - Protection : `"all"`, ou les couleurs dans l'ordre WUBRG séparées par des virgules (`"R,G"`) ;
  - Ward : le coût, 1 à 40 caractères.
- L'action `abilities` accepte, dans `gained`, un mot-clé seul (comme aujourd'hui) ou `{ keyword, param }`. Les anciennes
  actions restent valides (rejouées en mode test, parties en cours).
- `validate.ts` refuse un paramètre mal formé, un paramètre sur une capacité qui n'en prend pas, ou une capacité à paramètre
  sans paramètre.
- Le paramètre est public, comme la capacité : rien de caché n'est révélé.

## Compatibilité

- **Serveur de jeu plus ancien** : il refuse `Protection` et `Ward` (« Action invalide : gained ») jusqu'à la fusion, qui
  redéploie le Worker ; les autres capacités continuent de marcher.
- **Navigateur avec un état sans `param`** : rien ne plante, la capacité s'affiche sans précision.
- Pas de migration.

## Vérifications

- **Vitest** : validation des paramètres, état voulu (paramètre gardé, modifié), journal, aperçu, rejeu d'une ancienne action.
- **Navigateur** : `abilities-check` étendu (Protection rouge et vert, Parade {2}, modification, symboles et libellés,
  tablette, en ligne).

## Capacités ajoutées (suite)

La fenêtre passe de 17 à 43 capacités, rangées en quatre groupes avec un titre :

| Groupe | Capacités (nom Scryfall → nom français) |
|---|---|
| Courantes | les 17 d'avant (Vol… Protection, Parade) |
| Évasion | Fear → Peur, Intimidate → Intimidation, Shadow → Ombre, Skulk → Furtivité, Plainswalk / Islandwalk / Swampwalk / Mountainwalk / Forestwalk → Traversée des plaines / des îles / des marais / des montagnes / des forêts |
| Combat et retour | Prowess → Prouesse, Exalted → Exaltation, Wither → Flétrissure, Battle cry → Cri de guerre, Myriad → Myriade, Melee → Mêlée, Dethrone → Détrônement, Mentor → Mentor, Training → Entraînement, Persist → Persistance, Undying → Immortalité |
| Avec une valeur | Annihilator → Annihilateur, Toxic → Toxique, Afflict → Affliction, Bushido → Bushido, Afterlife → Après-vie, Absorb → Absorption |

- Les traversées sont cinq capacités distinctes, comme chez Scryfall (une carte imprimée « Forestwalk » est reconnue).
- **Capacités chiffrées** : paramètre = un nombre de 1 à 99 (`"2"`). Dans la fenêtre : un petit champ et des raccourcis
  1 à 4 ; valeur proposée 2 pour Annihilateur et Affliction, 1 pour les autres. « Valider » grisé si la valeur n'est pas
  un nombre de 1 à 99.
- Sur la carte : le symbole avec le nombre en petit ; en libellé « Annihilateur 3 ». Journal : « donne Annihilateur 3 à … »,
  « change Annihilateur de … : 4 ».
- Comme pour Protection et Parade, la valeur imprimée (« Annihilator 2 » sur la carte) n'est pas reprise.
- Hors champ pour l'instant : capacités anciennes au nom français incertain (Flanking, Rampage, Horsemanship…), traversée
  des terres non de base.
- Compatibilité : un serveur de jeu plus ancien refuse les nouvelles capacités (« Action invalide : gained ») jusqu'à la
  fusion ; les 17 d'avant continuent de marcher. Pas de migration.
