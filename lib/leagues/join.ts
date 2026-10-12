// Règles d'entrée dans une ligue, partagées par la route « rejoindre » et sa page.

export const INVITE_INVALID = "Ce lien d'invitation n'est plus valable. Demande-en un nouveau à l'organisateur."
export const LEAGUE_FINISHED = 'Cette ligue est terminée.'
export const JOIN_TOO_LATE = 'Les matchs ont déjà été générés : impossible de rejoindre cette ligue.'

/** Raison du refus d'entrer dans la ligue, ou null si c'est possible. */
export function joinRefusal(league: { is_active: boolean }, matchCount: number): string | null {
  if (!league.is_active) return LEAGUE_FINISHED
  if (matchCount > 0) return JOIN_TOO_LATE
  return null
}
