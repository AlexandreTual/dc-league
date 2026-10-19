# Permanents hors phase — conception

Date : 2026-10-19
Statut : réalisée

## But

Pouvoir faire passer un permanent hors phase (Teferi's Protection, Oubliette, Clever Concealment…) et le voir revenir
en phase, comme dans les règles (702.26) : un permanent hors phase est traité comme s'il n'existait pas, puis revient au
début du tour de son contrôleur, avec son état d'avant.

## Table

- Menu d'une carte en jeu, juste sous « Engager » : **« Passer hors phase »**, puis **« Revenir en phase »**. Sur ses
  cartes comme sur celles d'un adversaire (beaucoup d'effets de phasing visent les permanents des autres).
- Carte hors phase : estompée (grisée, transparente), avec la mention « Hors phase » au milieu ; une créature volante
  cesse de flotter. Elle reste à sa place, garde son engagement, ses marqueurs, sa force/endurance, sa loyauté et ses
  capacités données, et le retrouve en revenant.
- Bandeaux des adversaires : une carte hors phase n'est pas empilée avec une carte identique en phase.
- Journal : « Teferi, Time Raveler passe hors phase », « … revient en phase » ; « une carte face cachée » si elle l'est.

## Règles appliquées par le moteur

- **Début de tour** : quand le tour passe à un joueur, ses permanents hors phase reviennent en phase (une ligne au
  journal chacun), puis tous ses permanents se dégagent (règle 502).
- **« Tout dégager »** ne dégage pas un permanent hors phase (il n'existe pas).
- Quitter le champ de bataille efface l'état hors phase.
- Le reste n'est pas automatisé : on peut toujours déplacer, engager… une carte hors phase à la main. Le mot-clé
  « Phasing » imprimé (passer hors phase à chaque tour) n'est pas automatisé non plus : on clique soi-même.

## Moteur

- `CardInstance.phasedOut?: true` (et `VisibleCard`), absent en phase et hors du champ de bataille.
- Action `{ type: 'phase', id }` : bascule ; permise à tous les joueurs, sur une carte du champ de bataille.
- Serveur de jeu plus ancien : le champ manque, la carte s'affiche normalement ; l'action est refusée avec une erreur.
