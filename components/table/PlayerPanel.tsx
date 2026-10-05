'use client'

import { Crown, Flag, Heart, Minus, Plus, Skull } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import type { ClientAction } from '@/lib/game/room'
import { COMMANDER_DAMAGE_LETHAL, POISON_LETHAL, type Catalog, type PlayerView, type VisibleCard } from '@/lib/game/types'
import type { Lang } from './GameCard'
import ManaPool from './ManaPool'

const stepBtn = 'p-0.5 rounded hover:bg-dc-border disabled:opacity-30 disabled:hover:bg-transparent'

function Stepper({ label, value, alert = false, disabled, onChange, testId }: {
  label: React.ReactNode
  value: number
  alert?: boolean
  disabled: boolean
  onChange: (delta: number) => void
  testId?: string
}) {
  const step = (e: React.MouseEvent) => (e.shiftKey ? 5 : 1)
  return (
    <span className={`inline-flex items-center gap-0.5 ${alert ? 'text-dc-red-light font-semibold' : ''}`}>
      {label}
      <button className={stepBtn} disabled={disabled} onClick={(e) => onChange(-step(e))} aria-label="moins"><Minus className="w-3 h-3" /></button>
      <span className="min-w-[1.75rem] text-center" data-testid={testId}>{value}</span>
      <button className={stepBtn} disabled={disabled} onClick={(e) => onChange(step(e))} aria-label="plus"><Plus className="w-3 h-3" /></button>
    </span>
  )
}

/** Commandants des autres joueurs, connus par les cartes visibles (les commandants sont publics). */
function opposingCommanders(view: PlayerView, player: string): VisibleCard[] {
  const out = new Map<string, VisibleCard>()
  for (const p of Object.values(view.players)) {
    const { library: _, ...zones } = p.zones
    for (const cards of Object.values(zones)) {
      for (const c of cards) if (!c.hidden && c.isCommander && c.owner !== player) out.set(c.id, c)
    }
  }
  return [...out.values()]
}

/**
 * Compteurs d'un joueur : vie, poison, blessures de commandant (Commander), compteurs libres,
 * monarque et initiative. N'importe quel joueur peut les modifier, comme le permet le moteur.
 */
export default function PlayerPanel({ view, player, catalogs, lang, host, online, canAct, send, compact = false, onTitleClick }: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  host?: string
  online?: string[]
  canAct: boolean
  send: (action: ClientAction) => void
  compact?: boolean
  onTitleClick?: () => void
}) {
  const p = view.players[player]
  const active = view.activePlayer === player
  const commanders = view.format === 'commander' ? opposingCommanders(view, player) : []
  const disabled = !canAct
  const extraCounters = Object.entries(p.counters)

  return (
    <div
      data-panel={player}
      className={`rounded-xl border px-2 py-1.5 text-xs text-dc-text space-y-1 ${active ? 'border-dc-gold/70 bg-dc-gold/10' : 'border-dc-border bg-dc-surface/70'} ${p.eliminated ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {online && <span className={`w-2 h-2 rounded-full ${online.includes(player) ? 'bg-dc-green-light' : 'bg-dc-muted/40'}`} title={online.includes(player) ? 'en ligne' : 'hors ligne'} />}
        <button className="font-semibold text-sm hover:text-dc-gold truncate" onClick={onTitleClick} disabled={!onTitleClick} data-testid="player-name">{p.name}</button>
        {host === player && <Crown className="w-3.5 h-3.5 text-dc-gold" aria-label="hôte" />}
        {view.monarch === player && <span title="Monarque">👑</span>}
        {view.initiative === player && <Flag className="w-3.5 h-3.5 text-dc-gold" aria-label="initiative" />}
        {p.eliminated && <span className="text-dc-red-light flex items-center gap-0.5"><Skull className="w-3 h-3" /> éliminé</span>}
        {!p.kept && !p.eliminated && <span className="text-dc-muted italic">choisit sa main…</span>}
        {compact && p.poison > 0 && <span className="text-dc-green-light" title="Poison">☠ {p.poison}</span>}
        {compact && commanders.some((c) => (p.commanderDamage[c.id] ?? 0) > 0) && (
          <span className="text-dc-red-light" title="Blessures de commandant (maximum)">⚔ {Math.max(...commanders.map((c) => p.commanderDamage[c.id] ?? 0))}</span>
        )}
        <span className="ml-auto flex items-center gap-2 text-sm">
          {/* Ma réserve est en bas à droite de l'écran : son détail s'ouvre vers le haut, aligné à droite. */}
          <span className="text-xs"><ManaPool pool={p.mana} keep={p.keepMana} editable={canAct && player === view.me} send={send} openUp={player === view.me} alignRight /></span>
          <Stepper
            label={<Heart className="w-3.5 h-3.5 text-dc-red-light" />}
            value={p.life}
            alert={p.life <= 0}
            disabled={disabled}
            onChange={(delta) => send({ type: 'life', target: player, delta })}
            testId="player-life"
          />
        </span>
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stepper label="Poison" value={p.poison} alert={p.poison >= POISON_LETHAL} disabled={disabled}
            onChange={(delta) => send({ type: 'poison', target: player, delta })} />
          {commanders.map((c) => {
            const value = p.commanderDamage[c.id] ?? 0
            return (
              <Stepper key={c.id}
                label={<span className="truncate max-w-[7rem]" title={cardInfo(catalogs[c.owner], c, lang).name}>⚔ {view.players[c.owner]?.name}</span>}
                value={value} alert={value >= COMMANDER_DAMAGE_LETHAL} disabled={disabled}
                onChange={(delta) => send({ type: 'commanderDamage', target: player, commander: c.id, delta })}
                testId={`commander-damage-${c.owner}`} />
            )
          })}
          {extraCounters.map(([name, value]) => (
            <Stepper key={name} label={name} value={value} disabled={disabled}
              onChange={(delta) => send({ type: 'playerCounter', target: player, name, delta })} />
          ))}
          {canAct && (
            <span className="flex items-center gap-1 text-dc-muted">
              <button className="hover:text-dc-text" onClick={() => {
                const name = prompt('Nom du compteur (énergie, expérience…) ?')?.trim()
                if (name) send({ type: 'playerCounter', target: player, name, delta: 1 })
              }}>+ compteur</button>
              <button className="hover:text-dc-text" onClick={() => send({ type: 'setMonarch', to: view.monarch === player ? null : player })}>
                {view.monarch === player ? 'Retirer monarque' : 'Monarque'}
              </button>
              <button className="hover:text-dc-text" onClick={() => send({ type: 'setInitiative', to: view.initiative === player ? null : player })}>
                {view.initiative === player ? 'Retirer initiative' : 'Initiative'}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
