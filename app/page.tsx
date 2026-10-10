import Link from 'next/link'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { BarChart2, BookOpen, Calendar, Layers, Lock, LogIn, Play, Sword, Trophy, Users } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { computeLeaderboard } from '@/lib/leaderboard'
import { listPlayers, listCompletedMatches, countMatches, listPlayoffs } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import { listTables } from '@/lib/db-games'
import { features, seasonProgress, type Feature } from '@/lib/home'

export const runtime = 'edge'
export const revalidate = 0

const featureIcons: Record<Feature['key'], typeof Sword> = {
  ligue: Trophy,
  decks: Layers,
  test: Play,
  enligne: Users,
  stats: BarChart2,
  regles: BookOpen,
}

const podiumColors = ['rank-1', 'rank-2', 'rank-3']

const buttonClass = (primary: boolean) =>
  `inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
    primary
      ? 'bg-dc-gold text-dc-bg hover:bg-dc-gold-light'
      : 'border border-dc-gold/40 text-dc-gold hover:bg-dc-gold/10'
  }`

/** Saison en cours : avancement et podium. Rien de bloquant : une erreur de chargement masque seulement le bloc. */
async function loadSeason(db: D1Database) {
  const { data: league, error } = await getActiveLeague(db)
  if (error) return { state: 'failed' as const }
  if (!league) return { state: 'none' as const }
  const [players, completed, total, enrolled, playoffs] = await Promise.all([
    listPlayers(db),
    listCompletedMatches(db, league.id),
    countMatches(db, league.id),
    listLeaguePlayers(db, league.id),
    listPlayoffs(db, league.id),
  ])
  if ([players, completed, total, enrolled, playoffs].some((r) => r.error)) return { state: 'failed' as const }
  const enrolledIds = new Set((enrolled.data ?? []).map((lp) => lp.player_id))
  const podium = computeLeaderboard(
    (players.data ?? []).filter((p) => enrolledIds.has(p.id)),
    completed.data ?? [],
  ).slice(0, 3)
  return {
    state: 'ok' as const,
    league,
    played: completed.data?.length ?? 0,
    total: total.data ?? 0,
    playerCount: enrolledIds.size,
    podium,
    hasPlayoffs: (playoffs.data ?? []).length > 0,
  }
}

export default async function HomePage() {
  const db = getRequestContext<CloudflareEnv>().env.DB
  const user = await getCurrentUser()
  const isPlayer = !!user && !user.isBootstrap

  const [season, tables] = await Promise.all([
    loadSeason(db),
    isPlayer ? listTables(db) : Promise.resolve({ data: null }),
  ])
  const openTables = (tables.data ?? []).filter((t) => t.status === 'open').length

  return (
    <div className="space-y-12">
      {/* Présentation */}
      <section className="text-center space-y-4 pt-4">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Sword className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-4xl md:text-5xl font-bold text-dc-gold">Commander League</h1>
        <p className="text-dc-text max-w-xl mx-auto">
          La ligue de Magic entre amis. On s&apos;affronte en Duel Commander tout au long de la saison, et on se
          retrouve aussi en ligne pour des parties de Commander de 2 à 5 joueurs.
        </p>
        {user && <p className="text-dc-muted text-sm">Content de te revoir, {user.playerName}.</p>}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isPlayer ? (
            <>
              <Link href="/salon" className={buttonClass(true)}>
                <Users className="w-4 h-4" /> Jouer en ligne
              </Link>
              <Link href="/profil/decks" className={buttonClass(false)}>
                <Layers className="w-4 h-4" /> Mes decks
              </Link>
            </>
          ) : (
            <>
              {!user && (
                <Link href="/connexion" className={buttonClass(true)}>
                  <LogIn className="w-4 h-4" /> Se connecter
                </Link>
              )}
              <Link href="/classement" className={buttonClass(!!user)}>
                <Trophy className="w-4 h-4" /> Voir le classement
              </Link>
            </>
          )}
        </div>
        {isPlayer && openTables > 0 && (
          <p className="text-sm text-dc-muted">
            <span className="text-dc-gold font-semibold">{openTables}</span>{' '}
            {openTables > 1 ? 'tables attendent' : 'table attend'} des joueurs au salon.
          </p>
        )}
      </section>

      {/* Saison en cours */}
      <section aria-labelledby="saison" className="bg-dc-surface border border-dc-border rounded-2xl p-5 md:p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="saison" className="font-fantasy text-xl font-bold text-dc-gold">
            {season.state === 'ok' ? season.league.name : 'Saison en cours'}
          </h2>
          {season.state === 'ok' && (
            <p className="text-dc-muted text-xs">Duel Commander · Round Robin · Top 4</p>
          )}
        </div>

        {season.state === 'failed' ? (
          <p className="text-dc-muted text-sm">La saison n&apos;a pas pu être chargée. Réessaie dans un instant.</p>
        ) : season.state === 'none' ? (
          <p className="text-dc-muted text-sm">
            Pas de saison en cours pour le moment. Les saisons passées sont dans{' '}
            <Link href="/history" className="text-dc-gold hover:underline">l&apos;historique</Link>.
          </p>
        ) : (
          <>
            {season.hasPlayoffs && (
              <Link href="/playoffs" className="flex items-center gap-2 rounded-xl border border-dc-gold/40 bg-dc-gold/10 px-4 py-3 text-sm text-dc-gold hover:bg-dc-gold/15">
                <Trophy className="w-4 h-4 shrink-0" />
                <span>La phase finale est lancée : voir le tableau du Top 4 →</span>
              </Link>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dc-muted">
                  {season.total ? (
                    <><span className="text-dc-text font-semibold">{season.played}</span> / {season.total} matchs joués</>
                  ) : (
                    'Les matchs ne sont pas encore générés.'
                  )}
                </span>
                <span className="text-dc-muted">{season.playerCount} joueur{season.playerCount > 1 ? 's' : ''}</span>
              </div>
              {!!season.total && (
                <div
                  className="h-2 rounded-full bg-dc-border overflow-hidden"
                  role="progressbar"
                  aria-label="Avancement de la saison"
                  aria-valuenow={seasonProgress(season.played, season.total)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-gold-gradient" style={{ width: `${seasonProgress(season.played, season.total)}%` }} />
                </div>
              )}
            </div>

            {season.played > 0 && season.podium.length > 0 && (
              <ol className="grid gap-2 sm:grid-cols-3" aria-label="Podium provisoire">
                {season.podium.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-dc-border bg-dc-bg/40 px-3 py-2.5 min-w-0">
                    <Trophy className={`w-5 h-5 shrink-0 ${podiumColors[i]}`} aria-label={`${i + 1}ᵉ`} />
                    <span className="flex-1 min-w-0 truncate text-dc-text">{p.name}</span>
                    <span className="text-dc-gold font-semibold text-sm whitespace-nowrap">{p.points} pts</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link href="/classement" className="inline-flex items-center gap-1.5 text-dc-gold hover:underline">
                <Trophy className="w-4 h-4" /> Classement complet
              </Link>
              <Link href="/calendar" className="inline-flex items-center gap-1.5 text-dc-gold hover:underline">
                <Calendar className="w-4 h-4" /> Calendrier des matchs
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Ce qu'on trouve sur le site */}
      <section aria-labelledby="rubriques" className="space-y-5">
        <h2 id="rubriques" className="font-fantasy text-xl font-bold text-dc-gold text-center">Sur le site</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features(user).map((f) => {
            const Icon = featureIcons[f.key]
            return (
              <Link
                key={f.key}
                href={f.href}
                className="group flex flex-col gap-3 rounded-xl border border-dc-border bg-dc-surface p-5 hover:border-dc-gold/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-dc-gold/15 border border-dc-gold/30 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-dc-gold" />
                  </span>
                  <h3 className="font-fantasy font-semibold text-dc-text group-hover:text-dc-gold transition-colors">{f.title}</h3>
                </div>
                <p className="text-sm text-dc-muted flex-1">{f.text}</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-dc-gold">
                  {f.locked && <Lock className="w-3.5 h-3.5" aria-hidden />}
                  {f.locked ? 'Se connecter pour y accéder' : `${f.cta} →`}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Rejoindre */}
      {!user && (
        <section className="text-center space-y-2 border-t border-dc-border pt-8">
          <h2 className="font-fantasy text-lg font-semibold text-dc-gold">Rejoindre la ligue</h2>
          <p className="text-sm text-dc-muted max-w-md mx-auto">
            Les comptes se créent sur invitation : demande ton lien à l&apos;admin de la ligue, puis importe ton deck
            pour t&apos;inscrire à la prochaine saison.
          </p>
        </section>
      )}
    </div>
  )
}
