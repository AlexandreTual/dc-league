import type { Messages } from '../fr'

const ordinal = (n: number) => {
  const ten = n % 100
  if (ten >= 11 && ten <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

export const site: Messages['site'] = {
  home: {
    intro: 'Magic among friends. We face off in Duel Commander all season long, and we also meet up online for Commander games with 2 to 5 players.',
    welcomeBack: (name: string) => `Good to see you again, ${name}.`,
    playOnline: 'Play online',
    myDecks: 'My decks',
    login: 'Log in',
    seeLeagues: 'See the leagues',
    tablesWaiting: (n: number) => `${n > 1 ? 'tables are' : 'table is'} waiting for players in the lobby.`,
    ongoingLeagues: 'Ongoing leagues',
    allLeagues: 'All leagues →',
    seasonFailed: "Couldn't load the season. Try again in a moment.",
    noLeague: 'No league running right now.',
    createYours: 'Create your own',
    seeFinished: 'See finished leagues',
    playoffsStarted: 'The playoffs have started: see the Top 4 bracket →',
    ofMatchesPlayed: (total: number) => `/ ${total} matches played`,
    notGenerated: "The matches haven't been generated yet.",
    players: (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`,
    progress: 'Season progress',
    podium: 'Current podium',
    rank: ordinal,
    points: (n: number) => `${n} points`,
    fullStandings: 'Full standings',
    schedule: 'Match schedule',
    onSite: 'On the site',
    loginToAccess: 'Log in to access',
    joinTitle: 'Join the league',
    joinText: 'Accounts are invite-only: ask the site admin for your link, then import your deck and join a league.',
  },
  features: {
    ligue: {
      cta: 'See the leagues',
      title: 'Leagues',
      text: 'Create your league with friends, public or private, and invite your players with a link. In Duel Commander: everyone plays everyone, then the top 4 play the final stage.',
    },
    decks: {
      cta: 'My decks',
      title: 'Your decks',
      text: 'Import a deck from Moxfield, Archidekt or a pasted list. Cards in English or French, the deck tokens, Oracle text and rulings for every card.',
    },
    test: {
      cta: 'Pick a deck to playtest',
      title: 'Playtest',
      text: 'Play solo with your deck to test your opening hands, your curve and your combos, on the same table as online games.',
    },
    enligne: {
      cta: 'Open the lobby',
      title: 'Online games',
      text: 'Open a table in the lobby and play with 2 to 5 players, in Commander or Duel Commander: life totals, commander damage, tokens, dice.',
    },
    stats: {
      cta: 'See the stats',
      title: 'Stats and history',
      text: 'All-time standings across public leagues, head-to-head records and results of finished leagues.',
    },
    regles: {
      cta: 'Read the rules',
      title: 'Rules',
      text: 'Format, best-of-3 matches, allowed proxies and deck registration.',
    },
  },
  rules: {
    title: 'League Rules',
    intro: 'The league is played as a round robin (everyone plays everyone), followed by a Top 4 between the four best players.',
    scoring: 'Scoring',
    win: 'Win',
    winScores: '2-0 or 2-1',
    draw: 'Draw',
    loss: 'Loss',
    lossScores: '1-2 or 0-2',
    tiebreak: 'Players tied on points in the standings are separated by game difference (GW−GL), then number of wins, then head-to-head (among the tied players only, when three or more are tied), then a fixed random draw.',
    sections: {
      format: {
        title: 'Format',
        items: [
          'Duel Commander, 20 life',
          '100-card decks (1 commander + 99 cards)',
          'Max 1 copy of each card (except basic lands)',
          'Commander starts in the command zone',
        ],
      },
      matches: {
        title: 'Match structure',
        items: [
          'Best of 3 (BO3): first to win 2 games',
          'Time limit: 60 minutes per match',
          'When time is up: 5 extra turns',
          'Still tied after those 5 turns: the match is a draw (1 point each)',
        ],
      },
      proxies: {
        title: 'Proxies',
        items: [
          '100% allowed: we play the pilot, not the wallet',
          'Prints must be good quality and fully readable',
          'Opaque sleeves, identical for the whole deck',
          'No intentionally marked cards',
        ],
      },
      decklist: {
        title: 'Decklist & registration',
        items: [
          'Deck registration through a Moxfield link is required',
          'The deck is "locked" for the whole league',
          'No deck changes allowed between league matches',
          'Any problem: contact the admin before the match',
        ],
      },
    },
    banlist: 'Official banlist',
    banlistText: 'The league uses the official Duel Commander banlist, maintained by the mtgdc.info committee.',
    banlistLink: 'See the banlist on mtgdc.info',
    unofficial: 'Unofficial format for private use among friends.',
    trademark: 'Magic: The Gathering is a trademark of Wizards of the Coast.',
  },
  notFound: {
    title: 'Page not found',
    text: "This page doesn't exist or has moved.",
    home: 'Back to home',
  },
  error: {
    title: 'Something went wrong',
    page: "The page couldn't be displayed. Try again in a moment.",
    site: "The site couldn't be displayed. Try again in a moment.",
    retry: 'Try again',
    home: 'Back to home',
    code: 'Code to pass on:',
  },
  loadError: {
    title: (what: string) => `Couldn't load ${what}.`,
    retry: 'Reload the page in a moment to try again.',
  },
}
