type RoundMatch = { player1_id: string; player2_id: string; round_number: number }

/**
 * Exempts de chaque ronde : les inscrits qui n'ont aucun match dans la ronde (nombre impair de joueurs).
 * Un inscrit absent de tout le calendrier (arrivé après la génération) n'est exempt nulle part.
 * Les exempts gardent l'ordre de `playerIds`.
 */
export function byesByRound(playerIds: string[], matches: RoundMatch[]): Map<number, string[]> {
  const inCalendar = new Set(matches.flatMap((m) => [m.player1_id, m.player2_id]))
  const playing = new Map<number, Set<string>>()
  for (const m of matches) {
    const round = playing.get(m.round_number) ?? new Set<string>()
    round.add(m.player1_id).add(m.player2_id)
    playing.set(m.round_number, round)
  }
  const byes = new Map<number, string[]>()
  for (const [round, ids] of playing) {
    byes.set(round, playerIds.filter((id) => inCalendar.has(id) && !ids.has(id)))
  }
  return byes
}
