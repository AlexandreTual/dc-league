import Link from 'next/link'
import { listArchivedLeagues } from '@/lib/db-leagues'
import { Clock, Trophy } from 'lucide-react'

export const revalidate = 0

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function HistoryPage() {
  const { data: leagues } = listArchivedLeagues()

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Clock className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Historique</h1>
        <p className="text-dc-muted text-sm">Saisons archivées</p>
      </div>

      {(!leagues || leagues.length === 0) ? (
        <div className="text-center py-16 text-dc-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Aucune saison archivée pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/history/${league.id}`}
              className="flex items-center justify-between bg-dc-surface border border-dc-border rounded-xl p-4 hover:border-dc-gold/40 transition-all group"
            >
              <div>
                <p className="font-fantasy font-semibold text-dc-text group-hover:text-dc-gold transition-colors">
                  {league.name}
                </p>
                <p className="text-dc-muted text-xs mt-0.5">
                  {formatDate(league.started_at)}
                  {league.ended_at && ` → ${formatDate(league.ended_at)}`}
                </p>
              </div>
              <Trophy className="w-4 h-4 text-dc-muted group-hover:text-dc-gold transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
