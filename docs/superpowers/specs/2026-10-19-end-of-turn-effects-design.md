# Force/endurance jusqu'à la fin du tour et effets sur plusieurs créatures

Demande du 19 octobre : pouvoir modifier la force d'une créature jusqu'à la fin du tour, et appliquer un effet comme
Finale of Devastation (+X/+X et célérité à toutes mes créatures, jusqu'à la fin du tour).

Décisions du 19 octobre (questions posées à l'utilisateur) :

- **Deux lignes** dans l'encart et le menu de la carte : « Force » / « Endurance » (pour toujours, comme avant) puis
  « Force ce tour » / « Endurance ce tour » (écart affiché, nombre tapé = nouvel écart), effacées à la fin du tour.
  L'encart affiche le total ; liseré en pointillés et détail au survol tant qu'un écart du tour reste.
  « Réinitialiser force/endurance » retire les deux.
- **Fenêtre « Effet »** ouverte depuis le menu d'un groupe sélectionné (« Effet sur la sélection… ») et depuis le menu
  d'une de mes cartes en jeu (« Effet sur toutes mes créatures… » : mes créatures en phase, une carte face cachée
  comptant comme créature). Elle reprend la fenêtre « Capacités » avec, en plus, Force et Endurance (− / + et saisie) ;
  aucune capacité cochée au départ ; durée « Jusqu'à la fin du tour » par défaut. « Valider » grisé si rien n'est choisi.

## Moteur

- `CardInstance.ptTurn` (et `VisibleCard.ptTurn`, facultatif) : écart du tour, à côté de `ptMod`. Retiré en quittant le
  champ de bataille et pour tous les permanents au passage du tour (avec les capacités « jusqu'à la fin du tour »).
- Action `ptTurn { id, power, toughness }` : même règles que `pt` (tout joueur, carte en jeu), journal
  « Kenrith : 9/8 (+1/+0, +3/+3 ce tour) ».
- Action `effect { ids, power, toughness, gained, untilEndOfTurn? }` : cartes toutes en jeu, sans doublon, au moins
  quelque chose à donner. Écart ajouté à `ptTurn` ou `ptMod` ; capacités ajoutées à celles déjà données (une capacité
  imprimée et pas perdue est ignorée ; une capacité « ce tour » devient permanente si l'effet l'est, jamais l'inverse).
  Une ligne de journal, une annulation : « donne +10/+10 et Célérité à A et B (jusqu’à la fin du tour) » (au-delà de
  quatre cartes : trois noms et « N autres cartes »).
- Nouveaux types d'action plutôt qu'un champ ajouté à `pt` : un serveur de jeu plus ancien les refuse proprement
  (« Action inconnue ») au lieu d'appliquer l'écart pour toujours.

Vérifié par `scripts/effect-check.mjs`.
