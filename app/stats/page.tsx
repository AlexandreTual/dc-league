import { getRequestContext } from '@cloudflare/next-on-pages'
import { BarChart2, ExternalLink, Swords, Trophy, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { listMatchStats, computeAllStats, type PlayerRecord, type H2HEntry } from '@/lib/db-stats'

export const runtime = 'edge'
export const revalidate = 0

// ── Helpers ───────────────────────────────────────────────────────────────────

function winRate(wins: number, played: number) {
  if (played === 0) return '—'
  return `${Math.round((wins / played) * 100)} %`
}

function diff(gw: number, gl: number) {
  const d = gw - gl
  return (d > 0 ? '+' : '') + d
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value, color = 'text-dc-text' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`font-bold text-sm ${color}`}>{value}</div>
      <div className="text-dc-muted text-xs">{label}</div>
    </div>
  )
}

function CommanderThumb({ url, name }: { url: string | null; name: string | null }) {
  if (!url) return null
  return (
    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-dc-border shrink-0">
      <Image
        src={url}
        alt={name ?? 'Commander'}
        fill
        className="object-cover object-top"
        unoptimized
      />
    </div>
  )
}

// ── Global leaderboard section ────────────────────────────────────────────────

function GlobalLeaderboard({ players }: { players: PlayerRecord[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="w-5 h-5 text-dc-gold" />
        <h2 className="font-fantasy text-xl font-bold text-dc-gold">Palmarès Global</h2>
        <span className="text-dc-muted text-sm">toutes saisons confondues</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-dc-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dc-border bg-dc-surface/60">
              <th className="text-left px-4 py-3 text-dc-muted font-medium">#</th>
              <th className="text-left px-4 py-3 text-dc-muted font-medium">Joueur</th>
              <th className="text-center px-3 py-3 text-dc-muted font-medium">MJ</th>
              <th className="text-center px-3 py-3 text-dc-green-light font-medium">V</th>
              <th className="text-center px-3 py-3 text-dc-muted font-medium">N</th>
              <th className="text-center px-3 py-3 text-dc-red-light font-medium">D</th>
              <th className="text-center px-3 py-3 text-dc-muted font-medium">Diff</th>
              <th className="text-center px-3 py-3 text-dc-muted font-medium">%V</th>
              <th className="text-center px-3 py-3 text-dc-gold font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const d = p.gw - p.gl
              const isTop = i === 0
              return (
                <tr
                  key={p.player_id}
                  className={`border-b border-dc-border/50 transition-colors hover:bg-dc-border/20 ${isTop ? 'bg-dc-gold/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    {i === 0 ? (
                      <Trophy className="w-4 h-4 text-dc-gold" />
                    ) : (
                      <span className="text-dc-muted">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-fantasy font-semibold text-dc-text whitespace-nowrap">
                    {p.player_name}
                  </td>
                  <td className="px-3 py-3 text-center text-dc-muted">{p.played}</td>
                  <td className="px-3 py-3 text-center text-dc-green-light font-bold">{p.wins}</td>
                  <td className="px-3 py-3 text-center text-dc-muted">{p.draws}</td>
                  <td className="px-3 py-3 text-center text-dc-red-light">{p.losses}</td>
                  <td className={`px-3 py-3 text-center font-semibold ${d >= 0 ? 'text-dc-green-light' : 'text-dc-red-light'}`}>
                    {diff(p.gw, p.gl)}
                  </td>
                  <td className="px-3 py-3 text-center text-dc-muted">{winRate(p.wins, p.played)}</td>
                  <td className={`px-3 py-3 text-center font-fantasy font-bold text-lg ${isTop ? 'text-dc-gold' : 'text-dc-text'}`}>
                    {p.points}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-dc-muted text-xs text-center">
        Tri : Points · Différence GW−GL · Victoires · V=3pts N=1pt D=0pt
      </p>
    </section>
  )
}

// ── Per-deck stats section ────────────────────────────────────────────────────

function DeckStatsSection({ players }: { players: PlayerRecord[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-5 h-5 text-dc-gold" />
        <h2 className="font-fantasy text-xl font-bold text-dc-gold">Stats par Deck</h2>
        <span className="text-dc-muted text-sm">performances par commandant</span>
      </div>

      <div className="space-y-4">
        {players.map((player) => (
          <div key={player.player_id} className="bg-dc-surface border border-dc-border rounded-xl overflow-hidden">
            {/* Player header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-dc-border bg-dc-bg/40">
              <span className="font-fantasy font-bold text-dc-text">{player.player_name}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-dc-muted">{player.played} matchs</span>
                <span className="text-dc-green-light font-bold">{player.wins}V</span>
                <span className="text-dc-muted">{player.draws}N</span>
                <span className="text-dc-red-light">{player.losses}D</span>
                <span className="font-fantasy font-bold text-dc-gold">{player.points} pts</span>
              </div>
            </div>

            {/* Decks */}
            <div className="divide-y divide-dc-border/50">
              {player.decks.map((deck, di) => {
                const d = deck.gw - deck.gl
                const wr = deck.played > 0 ? Math.round((deck.wins / deck.played) * 100) : 0
                const deckLabel = deck.deck_name ?? 'Deck inconnu'

                return (
                  <div key={deck.deck_id ?? `none-${di}`} className="flex items-center gap-4 px-5 py-3 hover:bg-dc-border/10 transition-colors">
                    <CommanderThumb url={deck.commander_image_url} name={deck.deck_name} />

                    {/* Name + leagues */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-dc-text text-sm truncate">{deckLabel}</span>
                        {deck.moxfield_url && (
                          <a
                            href={deck.moxfield_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-dc-muted hover:text-dc-gold transition-colors shrink-0"
                            title="Voir sur Moxfield"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {deck.league_names.length > 0 && (
                        <p className="text-dc-muted text-xs mt-0.5 truncate">
                          {deck.league_names.join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-5 shrink-0">
                      <StatBadge label="MJ" value={deck.played} />
                      <StatBadge label="V" value={deck.wins} color="text-dc-green-light" />
                      <StatBadge label="N" value={deck.draws} />
                      <StatBadge label="D" value={deck.losses} color="text-dc-red-light" />
                      <StatBadge
                        label="Diff"
                        value={diff(deck.gw, deck.gl)}
                        color={d >= 0 ? 'text-dc-green-light' : 'text-dc-red-light'}
                      />
                      <StatBadge label="%V" value={`${wr}%`} />
                      <StatBadge label="Pts" value={deck.points} color="text-dc-gold" />
                    </div>
                  </div>
                )
              })}

              {player.decks.length === 0 && (
                <p className="px-5 py-4 text-dc-muted text-sm italic">Aucun deck enregistré.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Head-to-head section ──────────────────────────────────────────────────────

function H2HSection({ entries, players }: { entries: H2HEntry[]; players: PlayerRecord[] }) {
  // Sort by most contested (most matches) then by name
  const sorted = [...entries].sort((a, b) => (b.a_wins + b.b_wins + b.draws) - (a.a_wins + a.b_wins + a.draws))

  const playerNames = new Map(players.map((p) => [p.player_id, p.player_name]))

  // Build per-player H2H for the matrix view
  const allIds = players.map((p) => p.player_id)

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Swords className="w-5 h-5 text-dc-gold" />
        <h2 className="font-fantasy text-xl font-bold text-dc-gold">Confrontations Directes</h2>
        <span className="text-dc-muted text-sm">tête-à-tête entre joueurs</span>
      </div>

      {/* Mobile / compact: list view */}
      <div className="space-y-2 md:hidden">
        {sorted.map((e) => {
          const total = e.a_wins + e.b_wins + e.draws
          const aLeads = e.a_wins > e.b_wins
          const bLeads = e.b_wins > e.a_wins
          return (
            <div key={`${e.player_a_id}:${e.player_b_id}`} className="bg-dc-surface border border-dc-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 text-right">
                <span className={`font-fantasy font-semibold text-sm ${aLeads ? 'text-dc-text' : 'text-dc-muted'}`}>
                  {e.player_a_name}
                </span>
              </div>
              <div className="text-center shrink-0 min-w-[100px]">
                <div className="text-dc-text font-bold text-sm">
                  <span className={aLeads ? 'text-dc-green-light' : 'text-dc-red-light'}>{e.a_wins}</span>
                  {' – '}
                  <span className="text-dc-muted">{e.draws}</span>
                  {' – '}
                  <span className={bLeads ? 'text-dc-green-light' : 'text-dc-red-light'}>{e.b_wins}</span>
                </div>
                <div className="text-dc-muted text-xs">{total} match{total > 1 ? 's' : ''}</div>
              </div>
              <div className="flex-1 text-left">
                <span className={`font-fantasy font-semibold text-sm ${bLeads ? 'text-dc-text' : 'text-dc-muted'}`}>
                  {e.player_b_name}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: matrix view */}
      {allIds.length > 1 && (
        <div className="hidden md:block overflow-x-auto rounded-xl border border-dc-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dc-border bg-dc-surface/60">
                <th className="text-left px-3 py-2 text-dc-muted font-medium min-w-[120px]">↓ vs →</th>
                {allIds.map((id) => (
                  <th key={id} className="text-center px-3 py-2 text-dc-muted font-medium whitespace-nowrap">
                    {playerNames.get(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allIds.map((rowId) => (
                <tr key={rowId} className="border-b border-dc-border/40 hover:bg-dc-border/10">
                  <td className="px-3 py-2 font-fantasy font-semibold text-dc-text whitespace-nowrap">
                    {playerNames.get(rowId)}
                  </td>
                  {allIds.map((colId) => {
                    if (rowId === colId) {
                      return (
                        <td key={colId} className="px-3 py-2 text-center text-dc-border bg-dc-bg/30">
                          —
                        </td>
                      )
                    }
                    // Find h2h entry for this pair
                    const [aId, bId] = rowId < colId ? [rowId, colId] : [colId, rowId]
                    const entry = entries.find((e) => e.player_a_id === aId && e.player_b_id === bId)
                    if (!entry) {
                      return <td key={colId} className="px-3 py-2 text-center text-dc-muted/40">·</td>
                    }
                    // From row player's perspective
                    const myWins = rowId === entry.player_a_id ? entry.a_wins : entry.b_wins
                    const oppWins = rowId === entry.player_a_id ? entry.b_wins : entry.a_wins
                    const isAhead = myWins > oppWins
                    const isBehind = myWins < oppWins
                    return (
                      <td key={colId} className="px-3 py-2 text-center">
                        <span className={`font-bold ${isAhead ? 'text-dc-green-light' : isBehind ? 'text-dc-red-light' : 'text-dc-muted'}`}>
                          {myWins}
                        </span>
                        <span className="text-dc-muted">-{entry.draws}-</span>
                        <span className={`font-bold ${isBehind ? 'text-dc-green-light' : isAhead ? 'text-dc-red-light' : 'text-dc-muted'}`}>
                          {oppWins}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-dc-muted text-xs px-4 py-2 border-t border-dc-border/40">
            Lecture : V–N–D du point de vue du joueur en ligne. Ex : 2-0-1 = 2 victoires, 0 nuls, 1 défaite.
          </p>
        </div>
      )}
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StatsPage() {
  const { env } = getRequestContext<CloudflareEnv>()
  const { data: rows } = await listMatchStats(env.DB)

  const { players, h2h, totalMatches } = computeAllStats(rows ?? [])

  const hasData = players.length > 0

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <BarChart2 className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl md:text-4xl font-bold text-dc-gold">Statistiques</h1>
        <p className="text-dc-muted text-sm">
          {totalMatches > 0
            ? `${totalMatches} match${totalMatches > 1 ? 's' : ''} joué${totalMatches > 1 ? 's' : ''} · ${players.length} joueur${players.length > 1 ? 's' : ''}`
            : 'Aucun match joué pour le moment'}
        </p>
      </div>

      {!hasData ? (
        <div className="text-center py-20 text-dc-muted">
          <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Les statistiques apparaîtront une fois les premiers matchs joués.</p>
        </div>
      ) : (
        <>
          <GlobalLeaderboard players={players} />
          <DeckStatsSection players={players} />
          {h2h.length > 0 && <H2HSection entries={h2h} players={players} />}
        </>
      )}
    </div>
  )
}
