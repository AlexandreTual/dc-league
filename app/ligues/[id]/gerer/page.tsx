import type { Metadata } from 'next'
import { leagueMetadata } from '@/lib/page-titles'
import { getCurrentUser } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches, getPlayerIdsWithHistory } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import { getInviteToken, listLeaguePlayers } from '@/lib/db-leagues'
import { listAllDecksGrouped } from '@/lib/db-decks'
import { loadVisibleLeague } from '@/lib/leagues/load'
import { loadFailed } from '@/lib/load'
import LoadError from '@/components/LoadError'
import ManageLeague from './ManageLeague'

export const runtime = 'edge'

const pageDb = () => getRequestContext<CloudflareEnv>().env.DB

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return leagueMetadata(pageDb(), id, await getCurrentUser(), 'Gérer')
}
export const revalidate = 0

/** Gestion de la ligue : organisateur et admins seulement (404 pour les autres, comme une ligue invisible). */
export default async function ManageLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await loadVisibleLeague(id)
  if (!access) return <LoadError what="la gestion de la ligue" />
  if (!access.canManage) notFound()

  const db = getRequestContext<CloudflareEnv>().env.DB
  const results = await Promise.all([
    listPlayers(db),
    listMatches(db, id, true),
    listPlayoffs(db, id),
    countMatches(db, id),
    countCompletedMatches(db, id),
    listLeaguePlayers(db, id),
    listAllDecksGrouped(db),
    getPlayerIdsWithHistory(db),
    getInviteToken(db, id),
  ])
  if (loadFailed(...results)) return <LoadError what="la gestion de la ligue" />
  const [players, matches, playoffs, total, completed, leaguePlayers, decks, history, token] = results

  return (
    <ManageLeague
      league={access.league}
      isAdmin={access.viewer?.isAdmin ?? false}
      initialPlayers={(players.data ?? []) as unknown as Player[]}
      initialMatches={(matches.data ?? []) as unknown as Match[]}
      initialPlayoffs={playoffs.data ?? []}
      allRRCompleted={(total.data ?? 0) > 0 && total.data === completed.data}
      leaguePlayers={leaguePlayers.data ?? []}
      initialDecks={decks.data ?? {}}
      playerIdsWithHistory={history.data ?? []}
      inviteToken={token.data ?? null}
    />
  )
}
