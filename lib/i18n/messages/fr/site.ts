// Textes du site : accueil, règles de la ligue, pages d'erreur et 404.
const plural = (n: number) => (n > 1 ? 's' : '')

export const site = {
  home: {
    intro: "La ligue de Magic entre amis. On s'affronte en Duel Commander tout au long de la saison, et on se retrouve aussi en ligne pour des parties de Commander de 2 à 5 joueurs.",
    welcomeBack: (name: string) => `Content de te revoir, ${name}.`,
    playOnline: 'Jouer en ligne',
    myDecks: 'Mes decks',
    login: 'Se connecter',
    seeLeagues: 'Voir les ligues',
    /** Suit le nombre de tables ouvertes, en gras. */
    tablesWaiting: (n: number) => `${n > 1 ? 'tables attendent' : 'table attend'} des joueurs au salon.`,
    ongoingLeagues: 'Ligues en cours',
    allLeagues: 'Toutes les ligues →',
    seasonFailed: "La saison n'a pas pu être chargée. Réessaie dans un instant.",
    noLeague: 'Pas de ligue en cours pour le moment.',
    createYours: 'Crée la tienne',
    seeFinished: 'Voir les ligues terminées',
    playoffsStarted: 'La phase finale est lancée : voir le tableau du Top 4 →',
    /** Suit le nombre de matchs joués, en gras. */
    ofMatchesPlayed: (total: number) => `/ ${total} matchs joués`,
    notGenerated: 'Les matchs ne sont pas encore générés.',
    players: (n: number) => `${n} joueur${plural(n)}`,
    progress: 'Avancement de la saison',
    podium: 'Podium provisoire',
    rank: (n: number) => `${n}ᵉ`,
    points: (n: number) => `${n} pts`,
    fullStandings: 'Classement complet',
    schedule: 'Calendrier des matchs',
    onSite: 'Sur le site',
    loginToAccess: 'Se connecter pour y accéder',
    joinTitle: 'Rejoindre la ligue',
    joinText: "Les comptes se créent sur invitation : demande ton lien à l'admin du site, puis importe ton deck et rejoins une ligue.",
  },
  /** Rubriques de l'accueil (`lib/home.ts`). */
  features: {
    ligue: {
      cta: 'Voir les ligues',
      title: 'Les ligues',
      text: 'Crée ta ligue entre amis, publique ou privée, et invite tes joueurs par un lien. En Duel Commander : tout le monde affronte tout le monde, puis les 4 premiers jouent la phase finale.',
    },
    decks: {
      cta: 'Mes decks',
      title: 'Tes decks',
      text: 'Importe un deck depuis Moxfield, Archidekt ou une liste copiée. Cartes en français, jetons du deck, texte Oracle et règles de chaque carte.',
    },
    test: {
      cta: 'Choisir un deck à tester',
      title: 'Le mode test',
      text: 'Joue seul avec ton deck pour tester tes mains de départ, ta courbe et tes combos, avec la même table que les parties en ligne.',
    },
    enligne: {
      cta: 'Ouvrir le salon',
      title: 'Les parties en ligne',
      text: 'Ouvre une table au salon et joue de 2 à 5 joueurs, en Commander ou en Duel Commander : points de vie, blessures de commandant, jetons, dés.',
    },
    stats: {
      cta: 'Voir les statistiques',
      title: 'Statistiques et historique',
      text: 'Palmarès de toutes les ligues publiques, face-à-face entre joueurs et résultats des ligues terminées.',
    },
    regles: {
      cta: 'Lire les règles',
      title: 'Les règles',
      text: 'Format, déroulement des matchs en BO3, proxys autorisés et inscription des decks.',
    },
  },
  rules: {
    title: 'Règles de la Ligue',
    intro: "La ligue se joue en phase de Round Robin (tout le monde affronte tout le monde), suivie d'un Top 4 entre les quatre meilleurs joueurs.",
    scoring: 'Système de points',
    win: 'Victoire',
    winScores: '2-0 ou 2-1',
    draw: 'Nul',
    loss: 'Défaite',
    lossScores: '1-2 ou 0-2',
    tiebreak: "En cas d'égalité au classement : la différence de manches (GW−GL) est utilisée comme critère de départage.",
    sections: {
      format: {
        title: 'Format',
        items: [
          'Duel Commander — 20 points de vie',
          'Decks de 100 cartes (1 commandant + 99 cartes)',
          '1 exemplaire maximum de chaque carte (sauf terrains de base)',
          'Commandant en zone de commandement',
        ],
      },
      matches: {
        title: 'Déroulement des matchs',
        items: [
          'Best of 3 (BO3) — premier à 2 victoires de manches',
          'Temps limite : 60 minutes par match',
          "À l'expiration du temps : 5 tours additionnels",
          'Si toujours à égalité après les 5 tours : match nul (1 point chacun)',
        ],
      },
      proxies: {
        title: 'Proxys',
        items: [
          '100% autorisés — on joue le pilote, pas le portefeuille',
          'Les impressions doivent être de bonne qualité et parfaitement lisibles',
          'Sleeves opaques ou protège-cartes identiques pour tout le deck',
          'Pas de carte marquée intentionnellement',
        ],
      },
      decklist: {
        title: 'Decklist & Enregistrement',
        items: [
          'Inscription obligatoire du deck via un lien Moxfield',
          'Le deck est "locké" pour toute la durée de la ligue',
          'Aucun changement de deck autorisé entre les matchs de ligue',
          "En cas de problème : contacter l'admin avant le match",
        ],
      },
    },
    banlist: 'Banlist officielle',
    banlistText: 'La ligue utilise la banlist officielle du format Duel Commander, maintenue par le comité mtgdc.info.',
    banlistLink: 'Consulter la banlist sur mtgdc.info',
    unofficial: 'Format non-officiel pour usage privé entre amis.',
    trademark: 'Magic: The Gathering est une marque de Wizards of the Coast.',
  },
  notFound: {
    title: 'Page introuvable',
    text: "Cette page n'existe pas ou a été déplacée.",
    home: "Retour à l'accueil",
  },
  error: {
    title: 'Une erreur est survenue',
    page: "La page n'a pas pu s'afficher. Réessaie dans un instant.",
    site: "Le site n'a pas pu s'afficher. Réessaie dans un instant.",
    retry: 'Réessayer',
    home: "Retour à l'accueil",
  },
  /** `components/LoadError.tsx` : le complément (« les ligues »…) vient de la page. */
  loadError: {
    title: (what: string) => `Impossible de charger ${what}.`,
    retry: 'Réessaie dans un instant en rechargeant la page.',
  },
}
