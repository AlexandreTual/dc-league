export type Player = {
  id: string
  name: string
  avatar_url: string | null
  created_at: string
  moxfield_url?: string | null
  commander_image_url?: string | null
}

export type Match = {
  id: string
  player1_id: string
  player2_id: string
  score_p1: number | null
  score_p2: number | null
  is_completed: boolean
  round_number: number
  player1?: Player
  player2?: Player
}

/** Bilan d'un joueur ou d'un deck : ce que le barème met à jour. */
export type Tally = {
  points: number
  wins: number
  losses: number
  draws: number
  gw: number // game wins (total individual game wins)
  gl: number // game losses
  played: number
}

export type PlayerStats = Player & Tally

export function computeLeaderboard(players: Player[], matches: Match[]): PlayerStats[] {
  const stats: Record<string, PlayerStats> = {}

  for (const player of players) {
    stats[player.id] = {
      ...player,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      gw: 0,
      gl: 0,
      played: 0,
    }
  }

  for (const match of matches) {
    if (!match.is_completed) continue

    const p1 = stats[match.player1_id]
    const p2 = stats[match.player2_id]

    if (!p1 || !p2) continue

    recordMatch(p1, p2, match.score_p1 ?? 0, match.score_p2 ?? 0)
  }

  return Object.values(stats).sort(compareStandings)
}

/** Barème de la ligue : victoire 3 points, nul 1, défaite 0. Met à jour les deux bilans. */
export function recordMatch(a: Tally, b: Tally, scoreA: number, scoreB: number): void {
  a.gw += scoreA
  a.gl += scoreB
  b.gw += scoreB
  b.gl += scoreA
  a.played++
  b.played++

  if (scoreA > scoreB) {
    a.wins++
    a.points += 3
    b.losses++
  } else if (scoreB > scoreA) {
    b.wins++
    b.points += 3
    a.losses++
  } else {
    a.draws++
    a.points++
    b.draws++
    b.points++
  }
}

/** Ordre du classement : points, puis différence de manches, puis victoires (tri stable sinon). */
export function compareStandings(a: Tally, b: Tally): number {
  if (b.points !== a.points) return b.points - a.points
  const diffA = a.gw - a.gl
  const diffB = b.gw - b.gl
  if (diffB !== diffA) return diffB - diffA
  return b.wins - a.wins
}

/**
 * Generate all round-robin matches for N players.
 * Uses the circle/polygon algorithm for proper round assignment.
 * For odd N: one player gets a "bye" per round (not stored as a match).
 */
export function generateRoundRobinMatches(
  playerIds: string[]
): Array<{ player1_id: string; player2_id: string; round_number: number }> {
  const ids = [...playerIds]
  let hasBye = false

  // For odd number of players, add a sentinel "bye" player
  if (ids.length % 2 !== 0) {
    ids.push('BYE')
    hasBye = true
  }

  const n = ids.length
  const rounds = n - 1
  const matchesPerRound = n / 2
  const result: Array<{ player1_id: string; player2_id: string; round_number: number }> = []

  const rotatable = ids.slice(1)

  for (let round = 0; round < rounds; round++) {
    const currentIds = [ids[0], ...rotatable]

    for (let i = 0; i < matchesPerRound; i++) {
      const p1 = currentIds[i]
      const p2 = currentIds[n - 1 - i]

      // Skip bye matches
      if (hasBye && (p1 === 'BYE' || p2 === 'BYE')) continue

      result.push({
        player1_id: p1,
        player2_id: p2,
        round_number: round + 1,
      })
    }

    // Rotate: move last element of rotatable to front
    rotatable.unshift(rotatable.pop()!)
  }

  return result
}
