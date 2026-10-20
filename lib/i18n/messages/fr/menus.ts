// Textes du domaine « menus » : menus clic droit des cartes, des piles, de la main et d'un groupe de cartes
// (lib/game/menus.ts, lib/game/selection.ts) et textes propres au composant CardMenu.
export const menus = {
  /** Titre d'une carte que le joueur ne voit pas. */
  faceDownCard: 'Carte face cachée',
  oracle: 'Oracle et règles',
  askAi: 'Ajouter à la question IA',
  copy: {
    one: 'Créer un jeton copie',
    many: 'Créer des jetons copies…',
    howMany: 'Combien de jetons ?',
  },
  pt: {
    power: 'Force',
    toughness: 'Endurance',
    powerTurn: 'Force ce tour',
    toughnessTurn: 'Endurance ce tour',
    reset: 'Réinitialiser force/endurance',
  },
  loyalty: {
    label: 'Loyauté',
    reset: 'Réinitialiser la loyauté',
  },
  battlefield: {
    tap: 'Engager',
    untap: 'Dégager',
    phaseOut: 'Passer hors phase',
    phaseIn: 'Revenir en phase',
    transform: 'Retourner',
    faceUp: 'Face visible',
    faceDown: 'Face cachée',
    rotate: 'Pivoter à 180°',
    toFront: 'Mettre devant',
    toBack: 'Mettre derrière',
    counter: 'Compteur',
    abilities: 'Donner une capacité…',
    effectAll: 'Effet sur toutes mes créatures…',
    /** Ce que vise la fenêtre « Effet » ouverte depuis une carte. */
    effectAllTitle: 'toutes mes créatures',
    giveControl: (name: string) => `Donner le contrôle à ${name}`,
    gainControl: 'Prendre le contrôle',
  },
  /** Carte d'un adversaire renvoyée chez son propriétaire. */
  theirs: {
    toMyBattlefield: 'Sur mon champ de bataille',
    hand: 'Dans sa main',
    graveyard: 'Dans son cimetière',
    exile: 'Dans son exil',
  },
  hand: {
    title: 'Ma main',
    revealHand: 'Révéler ma main',
    revealAll: 'Révéler à tous',
    revealTo: (name: string) => `Révéler à ${name}`,
    /** Mulligan en cours : mettre la carte sous la bibliothèque. */
    toBottom: 'Mettre au-dessous',
  },
  /** Taxe de commandant (compteur du menu du commandant). */
  commanderTax: 'Taxe',
  sendTo: 'Envoyer vers',
  /** Destinations de « Envoyer vers ». */
  zones: {
    hand: 'Main',
    battlefield: 'Champ de bataille',
    graveyard: 'Cimetière',
    exile: 'Exil',
    command: 'Zone de commandement',
    libraryTop: 'Dessus de la bibliothèque',
    libraryBottom: 'Dessous de la bibliothèque',
  },
  library: {
    mine: (count: number) => `Bibliothèque (${count})`,
    of: (name: string) => `Bibliothèque de ${name}`,
    draw1: 'Piocher 1',
    drawN: 'Piocher N…',
    drawHowMany: 'Combien de cartes piocher ?',
    shuffle: 'Mélanger',
    look: 'Regarder les X du dessus…',
    lookHowMany: 'Combien de cartes regarder ?',
    /** Titre de la fenêtre des cartes regardées. */
    lookTitle: (n: number) => `Les ${n} cartes du dessus`,
    search: 'Chercher une carte…',
    searchTitle: 'Chercher dans la bibliothèque',
    revealTop: 'Révéler la carte du dessus',
    playRevealed: 'Jouer avec la carte du dessus révélée',
    hideTop: 'Cacher la carte du dessus',
    peekTop: 'Voir la carte du dessus (pour moi seul)',
    stopPeekTop: 'Ne plus voir la carte du dessus',
  },
  /** Menu d'un groupe de cartes sélectionnées. */
  selection: {
    title: (n: number) => `${n} cartes sélectionnées`,
    effect: 'Effet sur la sélection…',
    graveyard: 'Cimetière…',
    libraryTop: 'Dessus de la bibliothèque…',
    libraryBottom: 'Dessous de la bibliothèque…',
    clear: 'Tout désélectionner',
  },
  /** Composant CardMenu : bouton de l'aperçu au doigt, boutons et saisie d'un compteur. */
  ui: {
    close: 'Fermer',
    minus: (label: string) => `${label} moins`,
    plus: (label: string) => `${label} plus`,
    number: (label: string) => `${label} : nombre`,
  },
}
