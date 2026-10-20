import type { DbPlayoff } from '@/lib/db'

/** Les deux demi-finales sont jouées : la finale et la petite finale sont alors connues. */
export function semisPlayed(playoffs: DbPlayoff[]): boolean {
  return ['semi1', 'semi2'].every((stage) => playoffs.some((p) => p.stage === stage && p.is_completed))
}

/** Champion de la ligue : vainqueur de la finale jouée, seulement si les deux demi-finales le sont aussi. */
export function playoffChampion(playoffs: DbPlayoff[]): string | null {
  const final = playoffs.find((p) => p.stage === 'final')
  if (!final?.is_completed || !semisPlayed(playoffs)) return null
  return (final.score_p1 ?? 0) > (final.score_p2 ?? 0) ? final.player1_id : final.player2_id
}
