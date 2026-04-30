import { listPlayoffs, listPlayers, DbPlayoff, DbPlayer } from '@/lib/db'
import { Trophy } from 'lucide-react'
import PlayoffBracket from './PlayoffBracket'

export const revalidate = 0

export default async function PlayoffsPage() {
  const { data: playoffs } = listPlayoffs()
  const { data: players } = listPlayers()

  const playerMap: Record<string, DbPlayer> = {}
  for (const p of players ?? []) playerMap[p.id] = p

  return (
    <div className="space-y-8">
      {/* Header */}
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

      <PlayoffBracket playoffs={playoffs ?? []} playerMap={playerMap} />
    </div>
  )
}
