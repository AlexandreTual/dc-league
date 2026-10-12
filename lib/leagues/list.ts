/** Répartition de la page /ligues ; l'ordre d'entrée (plus récente d'abord) est conservé. */
export function groupLeagues<T extends { id: string; is_active: boolean }>(leagues: T[], mine: Set<string>) {
  return {
    mine: leagues.filter((l) => l.is_active && mine.has(l.id)),
    others: leagues.filter((l) => l.is_active && !mine.has(l.id)),
    finished: leagues.filter((l) => !l.is_active),
  }
}
