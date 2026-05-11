import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayoffs, listPlayers, DbPlayoff, DbPlayer } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import { Trophy } from 'lucide-react'
import PlayoffBracket from './PlayoffBracket'

export const runtime = 'edge'
export const revalidate = 0

export default async function PlayoffsPage() {
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: activeLeague } = await getActiveLeague(db)

  const [
    { data: playoffs },
    { data: players },
    { data: leaguePlayers },
  ] = await Promise.all([
    activeLeague ? listPlayoffs(db, activeLeague.id) : Promise.resolve({ data: [] }),
    listPlayers(db),
    activeLeague ? listLeaguePlayers(db, activeLeague.id) : Promise.resolve({ data: [] }),
  ])

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
        <h1 className="font-fantasy text-3xl md:text-4xl font-bold text-dc-gold">
          Playoffs — Top 4
        </h1>
        <p className="text-dc-muted text-sm">Phase finale · Commander League</p>
      </div>

      <PlayoffBracket playoffs={playoffs ?? [] as DbPlayoff[]} playerMap={playerMap} deckMap={deckMap} />
    </div>
  )
}
