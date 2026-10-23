// Calendrier d'une ligue vu par un joueur : ses matchs mis en valeur, filtre « Mes matchs », adversaires restants.
type CalendarMatch = { player1_id: string; player2_id: string; round_number: number; is_completed: boolean }

export function isMyMatch(match: CalendarMatch, playerId: string | null): boolean {
  return !!playerId && (match.player1_id === playerId || match.player2_id === playerId)
}

/**
 * La bascule n'apparaît qu'à un joueur qui a au moins un match dans la ligue (jamais à un visiteur) ;
 * sans elle, le filtre demandé est ignoré.
 */
export function calendarFor<M extends CalendarMatch>(matches: M[], playerId: string | null, wantMine: boolean) {
  const mine = matches.filter((m) => isMyMatch(m, playerId))
  const showToggle = mine.length > 0
  const mineOnly = showToggle && wantMine
  const remainingOpponents = mine
    .filter((m) => !m.is_completed)
    .sort((a, b) => a.round_number - b.round_number)
    .map((m) => (m.player1_id === playerId ? m.player2_id : m.player1_id))
  return { showToggle, mineOnly, shown: mineOnly ? mine : matches, remainingOpponents }
}
