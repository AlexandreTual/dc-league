type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
export type Result<T> = Ok<T> | Err
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }

export type MatchStatsRow = {
  id: string
  player1_id: string
  player2_id: string
  score_p1: number
  score_p2: number
  league_id: string
  league_name: string
  player1_name: string
  player2_name: string
  deck1_id: string | null
  deck1_name: string | null
  deck1_image: string | null
  deck1_moxfield: string | null
  deck2_id: string | null
  deck2_name: string | null
  deck2_image: string | null
  deck2_moxfield: string | null
}

export async function listMatchStats(db: D1Database): Promise<Result<MatchStatsRow[]>> {
  try {
    const { results } = await db.prepare(`
      SELECT
        m.id,
        m.player1_id, m.player2_id,
        m.score_p1, m.score_p2,
        m.league_id,
        l.name AS league_name,
        p1.name AS player1_name,
        p2.name AS player2_name,
        lp1.deck_id AS deck1_id,
        d1.name AS deck1_name,
        d1.commander_image_url AS deck1_image,
        d1.moxfield_url AS deck1_moxfield,
        lp2.deck_id AS deck2_id,
        d2.name AS deck2_name,
        d2.commander_image_url AS deck2_image,
        d2.moxfield_url AS deck2_moxfield
      FROM matches m
      JOIN leagues l ON l.id = m.league_id
      JOIN players p1 ON p1.id = m.player1_id
      JOIN players p2 ON p2.id = m.player2_id
      LEFT JOIN league_players lp1 ON lp1.league_id = m.league_id AND lp1.player_id = m.player1_id
      LEFT JOIN league_players lp2 ON lp2.league_id = m.league_id AND lp2.player_id = m.player2_id
      LEFT JOIN decks d1 ON d1.id = lp1.deck_id
      LEFT JOIN decks d2 ON d2.id = lp2.deck_id
      WHERE m.is_completed = 1
      ORDER BY l.started_at ASC
    `).all<Record<string, unknown>>()

    return ok(results.map((row) => ({
      id: row.id as string,
      player1_id: row.player1_id as string,
      player2_id: row.player2_id as string,
      score_p1: Number(row.score_p1),
      score_p2: Number(row.score_p2),
      league_id: row.league_id as string,
      league_name: row.league_name as string,
      player1_name: row.player1_name as string,
      player2_name: row.player2_name as string,
      deck1_id: (row.deck1_id as string) ?? null,
      deck1_name: (row.deck1_name as string) ?? null,
      deck1_image: (row.deck1_image as string) ?? null,
      deck1_moxfield: (row.deck1_moxfield as string) ?? null,
      deck2_id: (row.deck2_id as string) ?? null,
      deck2_name: (row.deck2_name as string) ?? null,
      deck2_image: (row.deck2_image as string) ?? null,
      deck2_moxfield: (row.deck2_moxfield as string) ?? null,
    })))
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Computed types ─────────────────────────────────────────────────────────────

export type DeckRecord = {
  deck_id: string | null
  deck_name: string | null
  commander_image_url: string | null
  moxfield_url: string | null
  wins: number
  losses: number
  draws: number
  points: number
  gw: number
  gl: number
  played: number
  league_names: string[]
}

export type PlayerRecord = {
  player_id: string
  player_name: string
  wins: number
  losses: number
  draws: number
  points: number
  gw: number
  gl: number
  played: number
  decks: DeckRecord[]
}

export type H2HEntry = {
  player_a_id: string
  player_a_name: string
  player_b_id: string
  player_b_name: string
  a_wins: number
  b_wins: number
  draws: number
}

export function computeAllStats(rows: MatchStatsRow[]): {
  players: PlayerRecord[]
  h2h: H2HEntry[]
  totalMatches: number
} {
  type PlayerAccum = {
    name: string
    wins: number; losses: number; draws: number; points: number; gw: number; gl: number; played: number
    decks: Map<string, DeckRecord>
  }
  type H2HAccum = {
    a_id: string; b_id: string; a_name: string; b_name: string
    a_wins: number; b_wins: number; draws: number
  }

  const playerMap = new Map<string, PlayerAccum>()
  const h2hMap = new Map<string, H2HAccum>()

  for (const row of rows) {
    const { player1_id, player2_id, score_p1, score_p2, player1_name, player2_name } = row

    // Ensure both players exist in map
    for (const [pid, pname] of [[player1_id, player1_name], [player2_id, player2_name]] as const) {
      if (!playerMap.has(pid)) {
        playerMap.set(pid, { name: pname, wins: 0, losses: 0, draws: 0, points: 0, gw: 0, gl: 0, played: 0, decks: new Map() })
      }
    }

    const p1 = playerMap.get(player1_id)!
    const p2 = playerMap.get(player2_id)!

    // Ensure decks exist in each player's deck map
    const dk1 = row.deck1_id ?? '__none__'
    const dk2 = row.deck2_id ?? '__none__'

    if (!p1.decks.has(dk1)) {
      p1.decks.set(dk1, {
        deck_id: row.deck1_id, deck_name: row.deck1_name,
        commander_image_url: row.deck1_image, moxfield_url: row.deck1_moxfield,
        wins: 0, losses: 0, draws: 0, points: 0, gw: 0, gl: 0, played: 0, league_names: [],
      })
    }
    if (!p2.decks.has(dk2)) {
      p2.decks.set(dk2, {
        deck_id: row.deck2_id, deck_name: row.deck2_name,
        commander_image_url: row.deck2_image, moxfield_url: row.deck2_moxfield,
        wins: 0, losses: 0, draws: 0, points: 0, gw: 0, gl: 0, played: 0, league_names: [],
      })
    }

    const d1 = p1.decks.get(dk1)!
    const d2 = p2.decks.get(dk2)!

    // Track league names per deck
    if (!d1.league_names.includes(row.league_name)) d1.league_names.push(row.league_name)
    if (!d2.league_names.includes(row.league_name)) d2.league_names.push(row.league_name)

    // Update raw game counts
    p1.gw += score_p1; p1.gl += score_p2; p1.played++
    p2.gw += score_p2; p2.gl += score_p1; p2.played++
    d1.gw += score_p1; d1.gl += score_p2; d1.played++
    d2.gw += score_p2; d2.gl += score_p1; d2.played++

    // Match results
    if (score_p1 > score_p2) {
      p1.wins++; p1.points += 3; p2.losses++
      d1.wins++; d1.points += 3; d2.losses++
    } else if (score_p2 > score_p1) {
      p2.wins++; p2.points += 3; p1.losses++
      d2.wins++; d2.points += 3; d1.losses++
    } else {
      p1.draws++; p1.points++; p2.draws++; p2.points++
      d1.draws++; d1.points++; d2.draws++; d2.points++
    }

    // H2H — key is alphabetically sorted pair
    const [aId, bId] = player1_id < player2_id
      ? [player1_id, player2_id]
      : [player2_id, player1_id]
    const h2hKey = `${aId}:${bId}`

    if (!h2hMap.has(h2hKey)) {
      h2hMap.set(h2hKey, {
        a_id: aId,
        b_id: bId,
        a_name: aId === player1_id ? player1_name : player2_name,
        b_name: bId === player1_id ? player1_name : player2_name,
        a_wins: 0, b_wins: 0, draws: 0,
      })
    }
    const h2h = h2hMap.get(h2hKey)!
    if (score_p1 > score_p2) {
      if (player1_id === aId) h2h.a_wins++; else h2h.b_wins++
    } else if (score_p2 > score_p1) {
      if (player2_id === aId) h2h.a_wins++; else h2h.b_wins++
    } else {
      h2h.draws++
    }
  }

  const players: PlayerRecord[] = [...playerMap.entries()]
    .map(([id, p]) => ({
      player_id: id,
      player_name: p.name,
      wins: p.wins, losses: p.losses, draws: p.draws,
      points: p.points, gw: p.gw, gl: p.gl, played: p.played,
      decks: [...p.decks.values()].sort((a, b) => b.points - a.points || b.played - a.played),
    }))
    .sort((a, b) => b.points - a.points || (b.gw - b.gl) - (a.gw - a.gl) || b.wins - a.wins)

  const h2h: H2HEntry[] = [...h2hMap.values()].map((e) => ({
    player_a_id: e.a_id, player_a_name: e.a_name,
    player_b_id: e.b_id, player_b_name: e.b_name,
    a_wins: e.a_wins, b_wins: e.b_wins, draws: e.draws,
  }))

  return { players, h2h, totalMatches: rows.length }
}
