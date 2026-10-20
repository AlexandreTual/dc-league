import { listCompletedMatches, listEnrolledPlayers, type Result } from '@/lib/db'
import { computeLeaderboard, type PlayerStats } from '@/lib/leaderboard'

export type Standings = {
  /** Classement des inscrits, du premier au dernier. */
  standings: PlayerStats[]
  /** Nombre de matchs de ligue joués. */
  played: number
}

/** Classement d'une ligue : seul calcul partagé par l'accueil, la page Classement et le tirage des playoffs. */
export async function loadStandings(db: D1Database, leagueId: string): Promise<Result<Standings>> {
  const [players, matches] = await Promise.all([listEnrolledPlayers(db, leagueId), listCompletedMatches(db, leagueId)])
  if (players.error !== null) return players
  if (matches.error !== null) return matches
  return { data: { standings: computeLeaderboard(players.data, matches.data), played: matches.data.length }, error: null }
}
