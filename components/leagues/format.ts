import type { DbLeague } from '@/lib/db-leagues'
import { formatDate, type Lang } from '@/lib/i18n/lang'
import type { Messages } from '@/lib/i18n/messages'

/** « 3 mai 2026 » / « 3 May 2026 ». */
export function leagueDate(dt: string, lang: Lang) {
  return formatDate(dt, lang, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** « Organisée par Ana », ou « Ligue du site » pour une ligue gérée par les admins. */
export function organizerLabel(league: Pick<DbLeague, 'owner_name'>, t: Messages): string {
  return league.owner_name ? t.leagues.format.organizedBy(league.owner_name) : t.leagues.format.siteLeague
}

/** « En cours » ou « Terminée le 3 mai 2026 ». */
export function statusLabel(league: Pick<DbLeague, 'is_active' | 'ended_at'>, t: Messages, lang: Lang): string {
  if (league.is_active) return t.leagues.format.ongoing
  return league.ended_at ? t.leagues.format.finishedOn(leagueDate(league.ended_at, lang)) : t.leagues.format.finished
}

/** Dans une liste : « Depuis le 3 mai 2026 » pour une ligue en cours, sinon son état. */
export function startedOrStatus(league: Pick<DbLeague, 'is_active' | 'ended_at' | 'started_at'>, t: Messages, lang: Lang): string {
  return league.is_active ? t.leagues.format.since(leagueDate(league.started_at, lang)) : statusLabel(league, t, lang)
}
