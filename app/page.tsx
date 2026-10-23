import Link from 'next/link'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { BarChart2, BookOpen, Calendar, Layers, Lock, LogIn, Play, Swords, Sword, Trophy, Users } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { countMatches, listMatches, listPlayers, listPlayoffs } from '@/lib/db'
import { getFeaturedLeague, listLeaguesFor, listMyLeagueIds } from '@/lib/db-leagues'
import { loadStandings } from '@/lib/standings'
import { viewerOf, type Viewer } from '@/lib/leagues/access'
import { listTables, type GameTable } from '@/lib/db-games'
import { features, myLeagueRank, myPendingMatches, myTables, seasonProgress, type Feature } from '@/lib/home'

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

/** Ligue mise en avant : avancement et podium. Rien de bloquant : une erreur de chargement masque seulement le bloc. */
async function loadSeason(db: D1Database, viewer: Viewer) {
  const { data: league, error } = await getFeaturedLeague(db, viewer)
  if (error) return { state: 'failed' as const }
  if (!league) return { state: 'none' as const }
  const [standings, total, playoffs] = await Promise.all([
    loadStandings(db, league.id),
    countMatches(db, league.id),
    listPlayoffs(db, league.id),
  ])
  if (standings.error !== null || [total, playoffs].some((r) => r.error)) return { state: 'failed' as const }
  return {
    state: 'ok' as const,
    league,
    played: standings.data.played,
    total: total.data ?? 0,
    playerCount: standings.data.standings.length,
    podium: standings.data.standings.slice(0, 3),
    hasPlayoffs: (playoffs.data ?? []).length > 0,
  }
}

/**
 * « À toi de jouer » : mes tables, mes ligues en cours avec ma place, mes matchs à jouer.
 * Seules mes ligues (inscrit ou organisateur) parmi celles que je peux voir : rien d'une ligue privée d'autrui.
 */
async function loadMyPlay(db: D1Database, viewer: NonNullable<Viewer>, tables: { data: GameTable[] | null }) {
  const [mine, visible, players] = await Promise.all([
    listMyLeagueIds(db, viewer.playerId),
    listLeaguesFor(db, viewer),
    listPlayers(db),
  ])
  if (tables.data === null || mine.error !== null || visible.error !== null || players.error !== null) return { state: 'failed' as const }
  const ids = new Set(mine.data)
  const leagues = visible.data.filter((l) => l.is_active && ids.has(l.id))
  const loaded = await Promise.all(leagues.map((l) => Promise.all([loadStandings(db, l.id), listMatches(db, l.id)])))
  if (loaded.some(([standings, matches]) => standings.error !== null || matches.error !== null)) return { state: 'failed' as const }
  const names = new Map(players.data.map((p) => [p.id, p.name]))
  return {
    state: 'ok' as const,
    tables: myTables(tables.data, viewer.playerId),
    leagues: leagues.map((l, i) => {
      const standings = loaded[i][0].data!
      return { id: l.id, name: l.name, played: standings.played, place: myLeagueRank(standings.standings, viewer.playerId) }
    }),
    matches: leagues.flatMap((l, i) => myPendingMatches(l, loaded[i][1].data!, viewer.playerId, names)),
  }
}

const ordinal = (n: number) => `${n}${n === 1 ? 'ᵉʳ' : 'ᵉ'}`

type MyPlay = Awaited<ReturnType<typeof loadMyPlay>>

/** Bloc du joueur en haut de l'accueil ; rien quand il n'a ni table, ni ligue en cours. */
function MyPlayBlock({ play }: { play: MyPlay }) {
  if (play.state === 'ok' && !play.tables.length && !play.leagues.length && !play.matches.length) return null
  return (
    <section aria-labelledby="a-toi" className="bg-dc-surface border border-dc-gold/40 rounded-2xl p-5 md:p-6 shadow-card space-y-5">
      <h2 id="a-toi" className="font-fantasy text-xl font-bold text-dc-gold">À toi de jouer</h2>
      {play.state === 'failed' ? (
        <p className="text-dc-muted text-sm">Tes parties et tes ligues n&apos;ont pas pu être chargées. Réessaie dans un instant.</p>
      ) : (
        <>
          {play.tables.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-dc-text">Mes tables</h3>
              <ul className="space-y-2" data-testid="my-tables">
                {play.tables.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl border border-dc-border bg-dc-bg/40 px-3 py-2.5">
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="text-dc-text">{t.format} · {t.seated}/{t.seats} joueurs</p>
                      <p className="text-dc-muted truncate">{t.others.length ? `Avec ${t.others.join(', ')}` : 'En attente de joueurs'}</p>
                    </div>
                    <Link href={`/tables/${t.id}`} className={`${buttonClass(t.action === 'Reprendre')} shrink-0 !px-3 !py-1.5`}>
                      {t.action}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {play.leagues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-dc-text">Mes ligues en cours</h3>
              <ul className="space-y-2" data-testid="my-leagues">
                {play.leagues.map((l) => (
                  <li key={l.id}>
                    <Link href={`/ligues/${l.id}/classement`} className="flex items-center gap-3 rounded-xl border border-dc-border bg-dc-bg/40 px-3 py-2.5 hover:border-dc-gold/40 transition-colors">
                      <Trophy className="w-4 h-4 shrink-0 text-dc-gold" aria-hidden />
                      <span className="flex-1 min-w-0 truncate text-dc-text">{l.name}</span>
                      <span className="text-sm text-dc-muted whitespace-nowrap">
                        {!l.place ? 'Organisateur' : l.played === 0 ? 'Aucun match joué' : (
                          <><span className="text-dc-gold font-semibold">{ordinal(l.place.rank)}</span> sur {l.place.of} · {l.place.points} pts</>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {play.matches.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-dc-text">Mes matchs à jouer</h3>
              <ul className="space-y-2" data-testid="my-matches">
                {play.matches.map((m) => (
                  <li key={m.id}>
                    <Link href={`/ligues/${m.leagueId}/calendrier`} className="flex items-center gap-3 rounded-xl border border-dc-border bg-dc-bg/40 px-3 py-2.5 hover:border-dc-gold/40 transition-colors">
                      <Swords className="w-4 h-4 shrink-0 text-dc-gold" aria-hidden />
                      <span className="flex-1 min-w-0 sm:flex sm:items-baseline sm:gap-3">
                        <span className="block truncate text-dc-text">contre {m.opponent}</span>
                        <span className="block truncate text-sm text-dc-muted">{m.leagueName} · journée {m.round}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default async function HomePage() {
  const db = getRequestContext<CloudflareEnv>().env.DB
  const user = await getCurrentUser()
  const isPlayer = !!user && !user.isBootstrap

  const viewer = viewerOf(user)
  const [season, tables] = await Promise.all([
    loadSeason(db, viewer),
    isPlayer ? listTables(db) : Promise.resolve({ data: null }),
  ])
  const play = isPlayer && viewer ? await loadMyPlay(db, viewer, tables) : null
  const openTables = (tables.data ?? []).filter((t) => t.status === 'open').length

  return (
    <div className="space-y-12">
      {/* À toi de jouer : en haut pour un joueur, la présentation passe en dessous */}
      {play && <MyPlayBlock play={play} />}

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
              <Link href="/ligues" className={buttonClass(!!user)}>
                <Trophy className="w-4 h-4" /> Voir les ligues
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
            {season.state === 'ok' ? season.league.name : 'Ligues en cours'}
          </h2>
          <Link href="/ligues" className="text-dc-gold text-xs hover:underline">Toutes les ligues →</Link>
        </div>

        {season.state === 'failed' ? (
          <p className="text-dc-muted text-sm">La saison n&apos;a pas pu être chargée. Réessaie dans un instant.</p>
        ) : season.state === 'none' ? (
          <p className="text-dc-muted text-sm">
            Pas de ligue en cours pour le moment.{' '}
            {isPlayer ? (
              <Link href="/ligues/nouvelle" className="text-dc-gold hover:underline">Crée la tienne</Link>
            ) : (
              <Link href="/ligues" className="text-dc-gold hover:underline">Voir les ligues terminées</Link>
            )}
            .
          </p>
        ) : (
          <>
            {season.hasPlayoffs && (
              <Link href={`/ligues/${season.league.id}/playoffs`} className="flex items-center gap-2 rounded-xl border border-dc-gold/40 bg-dc-gold/10 px-4 py-3 text-sm text-dc-gold hover:bg-dc-gold/15">
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
              <Link href={`/ligues/${season.league.id}/classement`} className="inline-flex items-center gap-1.5 text-dc-gold hover:underline">
                <Trophy className="w-4 h-4" /> Classement complet
              </Link>
              <Link href={`/ligues/${season.league.id}/calendrier`} className="inline-flex items-center gap-1.5 text-dc-gold hover:underline">
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
            Les comptes se créent sur invitation : demande ton lien à l&apos;admin du site, puis importe ton deck
            et rejoins une ligue.
          </p>
        </section>
      )}
    </div>
  )
}
