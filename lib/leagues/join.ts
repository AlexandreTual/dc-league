// Règles d'entrée dans une ligue, partagées par la route « rejoindre » et sa page.
import { fr } from '@/lib/i18n/messages/fr'

// Textes en français renvoyés par la route (ses erreurs passent au dictionnaire avec les autres routes API).
export const INVITE_INVALID = fr.leagues.join.inviteInvalid
export const LEAGUE_FINISHED = fr.leagues.join.leagueFinished
export const JOIN_TOO_LATE = fr.leagues.join.tooLate

/** Raison du refus d'entrer dans la ligue (clé de `t.leagues.join`), ou null si c'est possible. */
export function joinBlock(league: { is_active: boolean }, matchCount: number): 'leagueFinished' | 'tooLate' | null {
  if (!league.is_active) return 'leagueFinished'
  if (matchCount > 0) return 'tooLate'
  return null
}

/** Raison du refus en français, ou null si c'est possible. */
export function joinRefusal(league: { is_active: boolean }, matchCount: number): string | null {
  const block = joinBlock(league, matchCount)
  return block ? fr.leagues.join[block] : null
}

/** Lien complet à partager pour rejoindre une ligue. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin}/ligues/rejoindre/${encodeURIComponent(token)}`
}

/** La page de connexion explique qu'il faut un compte quand on arrive d'un lien de ligue. */
export function isLeagueInvitePath(from: string | null | undefined): boolean {
  return !!from && from.startsWith('/ligues/rejoindre/')
}
