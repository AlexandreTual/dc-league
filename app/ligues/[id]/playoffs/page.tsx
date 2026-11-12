import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayoffs, listPlayers, DbPlayoff, DbPlayer } from '@/lib/db'
import { listLeaguePlayers } from '@/lib/db-leagues'
import { loadVisibleLeague } from '@/lib/leagues/load'
import { Trophy } from 'lucide-react'
import PlayoffBracket from './PlayoffBracket'
import LoadError from '@/components/LoadError'
import { getMessages } from '@/lib/i18n/server'

export const runtime = 'edge'
export const revalidate = 0

export default async function PlayoffsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const [access, t] = await Promise.all([loadVisibleLeague(id), getMessages()])
  const p = t.leagues.playoffs
  if (!access) return <LoadError what={p.loadWhat} />

  const [
    { data: playoffs, error: playoffsError },
    { data: players, error: playersError },
    { data: leaguePlayers, error: leaguePlayersError },
  ] = await Promise.all([
    listPlayoffs(db, id),
    listPlayers(db),
    listLeaguePlayers(db, id),
  ])
  if (playoffsError || playersError || leaguePlayersError) return <LoadError what={p.loadWhat} />

  const playerMap: Record<string, DbPlayer> = {}
  for (const p of players ?? []) playerMap[p.id] = p

  const deckMap: Record<string, { deck_name: string | null; commander_image_url: string | null; moxfield_url: string | null }> = {}
  for (const lp of leaguePlayers ?? []) {
    deckMap[lp.player_id] = {
      deck_name: lp.deck_name ?? null,
      commander_image_url: lp.deck_commander_image_url ?? lp.commander_image_url ?? null,
      moxfield_url: lp.deck_moxfield_url ?? lp.moxfield_url ?? null,
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Trophy className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h2 className="font-fantasy text-2xl md:text-3xl font-bold text-dc-gold">
          {p.title}
        </h2>
        <p className="text-dc-muted text-sm">{p.subtitle}</p>
      </div>

      <PlayoffBracket playoffs={playoffs ?? [] as DbPlayoff[]} playerMap={playerMap} deckMap={deckMap} />
    </div>
  )
}
