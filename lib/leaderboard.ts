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

/**
 * Classement d'une ligue : points, différence de manches, victoires, puis départage des égalités
 * parfaites (confrontation directe, puis tirage fixe propre à la ligue : `breakTies`).
 */
export function computeLeaderboard(players: Player[], matches: Match[], leagueId: string): PlayerStats[] {
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

  const counted = matches.filter((m) => m.is_completed && stats[m.player1_id] && stats[m.player2_id])
  for (const match of counted) {
    recordMatch(stats[match.player1_id], stats[match.player2_id], match.score_p1 ?? 0, match.score_p2 ?? 0)
  }

  return breakTies(Object.values(stats).sort(compareStandings), counted, leagueId)
}

/**
 * Départage des joueurs à égalité parfaite (`compareStandings` nul) : mini-classement aux points
 * sur leurs seuls matchs entre eux (à deux : la confrontation directe), puis tirage fixe.
 */
function breakTies<T extends Player & Tally>(sorted: T[], matches: Match[], leagueId: string): T[] {
  const result: T[] = []
  let start = 0
  while (start < sorted.length) {
    let end = start + 1
    while (end < sorted.length && compareStandings(sorted[start], sorted[end]) === 0) end++
    const group = sorted.slice(start, end)
    if (group.length > 1) {
      const ids = new Set(group.map((p) => p.id))
      const headToHead = new Map(group.map((p) => [p.id, 0]))
      for (const m of matches) {
        if (!ids.has(m.player1_id) || !ids.has(m.player2_id)) continue
        const s1 = m.score_p1 ?? 0
        const s2 = m.score_p2 ?? 0
        if (s1 > s2) headToHead.set(m.player1_id, headToHead.get(m.player1_id)! + 3)
        else if (s2 > s1) headToHead.set(m.player2_id, headToHead.get(m.player2_id)! + 3)
        else {
          headToHead.set(m.player1_id, headToHead.get(m.player1_id)! + 1)
          headToHead.set(m.player2_id, headToHead.get(m.player2_id)! + 1)
        }
      }
      const draw = new Map(group.map((p) => [p.id, drawKey(leagueId, p.id)]))
      group.sort((a, b) =>
        headToHead.get(b.id)! - headToHead.get(a.id)!
        || draw.get(a.id)! - draw.get(b.id)!
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    }
    result.push(...group)
    start = end
  }
  return result
}

/** Tirage au sort fixe : empreinte FNV-1a (32 bits) de « ligue:joueur », la même à chaque affichage. */
function drawKey(leagueId: string, playerId: string): number {
  let hash = 0x811c9dc5
  for (const char of `${leagueId}:${playerId}`) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
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

/** Ordre du classement : points, puis différence de manches, puis victoires (égalités : `breakTies` dans une ligue). */
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
