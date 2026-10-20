'use client'

import { useState } from 'react'
import { Castle, Crown, Flag, Heart, Minus, Plus, Radiation, Skull, Star, Swords, Tag, Ticket, Zap, type LucideIcon } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import type { ClientAction } from '@/lib/game/room'
import { MARKER_NAME_MAX, markerLabel, markerRows, newMarkerError, PRESET_MARKERS, sameMarker, type MarkerRow } from '@/lib/game/player-markers'
import type { Catalog, PlayerView, VisibleCard } from '@/lib/game/types'
import type { Lang } from './GameCard'
import { hasDungeons, openDungeon, venture } from './dungeon'
import { touchTarget } from './touch'
import { useT } from '@/components/i18n/I18nProvider'

const stepBtn = `p-0.5 rounded hover:bg-dc-border disabled:opacity-30 disabled:hover:bg-transparent ${touchTarget}`

export function Stepper({ label, value, alert = false, disabled, onChange, testId }: {
  label: React.ReactNode
  value: number
  alert?: boolean
  disabled: boolean
  onChange: (delta: number) => void
  testId?: string
}) {
  const step = (e: React.MouseEvent) => (e.shiftKey ? 5 : 1)
  const pl = useT().table.player
  const what = typeof label === 'string' ? label : testId?.startsWith('commander-damage') ? pl.commanderDamageWord : pl.lifeWord
  return (
    <span className={`inline-flex items-center gap-0.5 ${alert ? 'text-dc-red-light font-semibold' : ''}`}>
      {label}
      <button className={stepBtn} disabled={disabled} onClick={(e) => onChange(-step(e))} aria-label={pl.minus(what)}><Minus className="w-3 h-3" /></button>
      <span className="min-w-[1.75rem] text-center" data-testid={testId}>{value}</span>
      <button className={stepBtn} disabled={disabled} onClick={(e) => onChange(step(e))} aria-label={pl.plus(what)}><Plus className="w-3 h-3" /></button>
    </span>
  )
}

/** Commandants des autres joueurs, connus par les cartes visibles (les commandants sont publics). */
export function opposingCommanders(view: PlayerView, player: string): VisibleCard[] {
  const out = new Map<string, VisibleCard>()
  for (const p of Object.values(view.players)) {
    const { library: _, ...zones } = p.zones
    for (const cards of Object.values(zones)) {
      for (const c of cards) if (!c.hidden && c.isCommander && c.owner !== player) out.set(c.id, c)
    }
  }
  return [...out.values()]
}

const PRESET_ICONS: Record<string, LucideIcon> = { Énergie: Zap, Expérience: Star, Rad: Radiation, Tickets: Ticket }

function markerIcon(row: MarkerRow) {
  const cls = 'w-4 h-4 shrink-0'
  if (row.kind === 'poison') return <Skull className={`${cls} text-dc-green-light`} />
  if (row.kind === 'commander') return <Swords className={`${cls} text-dc-red-light`} />
  const Icon = row.preset ? PRESET_ICONS[PRESET_MARKERS.find((n) => sameMarker(n, row.name)) ?? ''] ?? Tag : Tag
  return <Icon className={`${cls} text-dc-gold`} />
}

/** −, + et interrupteurs de la liste : 28 px à la souris, 44 px sur tablette. */
const rowBtn = `w-7 h-7 tablet:w-11 tablet:h-11 shrink-0 flex items-center justify-center rounded-md tablet:rounded-lg border border-dc-border bg-dc-border/50 hover:border-dc-gold/50 disabled:opacity-30 disabled:hover:border-dc-border`
const rowIcon = 'w-3.5 h-3.5 tablet:w-5 tablet:h-5'
const dungeonBtn = 'px-2 h-7 tablet:h-11 rounded-md tablet:rounded-lg border border-dc-gold/40 text-dc-gold hover:border-dc-gold'

/** Une ligne : icône, nom, valeur, −, + (Maj : ±5). */
function MarkerLine({ row, icon, label, title, disabled, onChange }: {
  row: MarkerRow
  icon: React.ReactNode
  label: string
  title?: string
  disabled: boolean
  onChange: (delta: number) => void
}) {
  const step = (e: React.MouseEvent) => (e.shiftKey ? 5 : 1)
  const pl = useT().table.player
  const alert = row.kind !== 'counter' && row.alert
  const name = row.kind === 'commander' ? pl.damageFrom(label) : label
  return (
    <li className={`flex items-center gap-2 py-1 ${alert ? 'text-dc-red-light font-semibold' : ''}`} data-marker={row.key} title={title}>
      {icon}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      <span className={`min-w-[1.75rem] text-center text-sm tabular-nums ${row.value === 0 ? 'text-dc-muted' : ''}`}
        data-testid={row.kind === 'commander' ? `commander-damage-${row.owner}` : `marker-${row.key}`}>{row.value}</span>
      <button className={rowBtn} disabled={disabled || row.value === 0} onClick={(e) => onChange(-step(e))} aria-label={pl.minus(name)}><Minus className={rowIcon} /></button>
      <button className={rowBtn} disabled={disabled} onClick={(e) => onChange(step(e))} aria-label={pl.plus(name)}><Plus className={rowIcon} /></button>
    </li>
  )
}

/** Interrupteur (monarque, initiative). */
function Toggle({ icon, label, on, disabled, onToggle }: { icon: React.ReactNode; label: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-center gap-2 py-1">
      {icon}
      <span className="flex-1">{label}</span>
      <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onToggle}
        className={`relative w-11 h-6 tablet:w-14 tablet:h-11 shrink-0 rounded-full border transition-colors disabled:opacity-30 ${on ? 'bg-dc-gold/70 border-dc-gold' : 'bg-dc-border border-dc-muted/40'}`}>
        <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 tablet:w-6 tablet:h-6 rounded-full bg-dc-text transition-all ${on ? 'right-1' : 'left-1'}`} />
      </button>
    </li>
  )
}

/**
 * Marqueurs d'un joueur : vie en tête, puis la liste (poison, blessures de commandant, marqueurs prédéfinis
 * et libres, monarque et initiative) et l'ajout d'un marqueur à la volée.
 * N'importe quel joueur peut les modifier, comme le permet le moteur.
 */
export default function PlayerPanel({ view, player, catalogs, lang, host, online, canAct, send, onTitleClick }: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  host?: string
  online?: string[]
  canAct: boolean
  send: (action: ClientAction) => void
  onTitleClick?: () => void
}) {
  const t = useT()
  const pl = t.table.player
  const p = view.players[player]
  const active = view.activePlayer === player
  const commanders = view.format === 'commander' ? opposingCommanders(view, player) : []
  const disabled = !canAct
  const rows = markerRows(p, commanders)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const commanderCard = (id: string) => commanders.find((c) => c.id === id)
  const rowLabel = (row: MarkerRow) => {
    if (row.kind === 'poison') return t.table.markers.poison
    if (row.kind === 'counter') return markerLabel(row.name, t)
    const c = commanderCard(row.commander)
    return c ? cardInfo(catalogs[c.owner], c, lang).name : pl.commander
  }
  const rowTitle = (row: MarkerRow) =>
    row.kind === 'commander' ? pl.commanderDamageTitle(view.players[row.owner]?.name ?? '?') : undefined

  return (
    <div
      data-panel={player}
      className={`rounded-xl border px-2 py-1.5 text-xs text-dc-text space-y-1 ${active ? 'border-dc-gold/70 bg-dc-gold/10' : 'border-dc-border bg-dc-surface/70'} ${p.eliminated ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {online && <span className={`w-2 h-2 rounded-full ${online.includes(player) ? 'bg-dc-green-light' : 'bg-dc-muted/40'}`} title={online.includes(player) ? pl.online : pl.offline} />}
        <button className="font-semibold text-sm hover:text-dc-gold truncate" onClick={onTitleClick} disabled={!onTitleClick} data-testid="player-name">{p.name}</button>
        {host === player && <Crown className="w-3.5 h-3.5 text-dc-gold" aria-label={pl.host} />}
        {view.monarch === player && <span title={t.table.markers.monarch}>👑</span>}
        {view.initiative === player && <Flag className="w-3.5 h-3.5 text-dc-gold" aria-label={pl.initiativeAria} />}
        {p.eliminated && <span className="text-dc-red-light flex items-center gap-0.5"><Skull className="w-3 h-3" /> {pl.eliminated}</span>}
        {!p.kept && !p.eliminated && <span className="text-dc-muted italic">{pl.choosingHand}</span>}
        <span className="ml-auto flex items-center gap-2 text-sm">
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
      <ul className="divide-y divide-dc-border/60 border-t border-dc-border/60" data-testid="markers">
        {rows.map((row) => (
          <MarkerLine key={row.key} row={row} icon={markerIcon(row)} label={rowLabel(row)} title={rowTitle(row)} disabled={disabled}
            onChange={(delta) => send(
              row.kind === 'poison' ? { type: 'poison', target: player, delta }
                : row.kind === 'commander' ? { type: 'commanderDamage', target: player, commander: row.commander, delta }
                  : { type: 'playerCounter', target: player, name: row.name, delta },
            )} />
        ))}
        <Toggle icon={<Crown className="w-4 h-4 text-dc-gold" />} label={t.table.markers.monarch} on={view.monarch === player} disabled={disabled}
          onToggle={() => send({ type: 'setMonarch', to: view.monarch === player ? null : player })} />
        <Toggle icon={<Flag className="w-4 h-4 text-dc-gold" />} label={t.table.markers.initiative} on={view.initiative === player} disabled={disabled}
          onToggle={() => send({ type: 'setInitiative', to: view.initiative === player ? null : player })} />
        {hasDungeons(view) && (player === view.me && canAct || p.dungeon) && (
          <li className="flex flex-wrap items-center gap-1.5 py-1" data-testid="dungeon-row">
            <Castle className="w-4 h-4 shrink-0 text-dc-gold" />
            <span className="flex-1">{t.table.dungeons.row}</span>
            {player === view.me && canAct && <>
              <button className={dungeonBtn} onClick={() => venture(view, 'dungeon', send)} data-testid="venture-dungeon">{t.table.dungeons.venture}</button>
              {view.initiative === player && (
                <button className={dungeonBtn} onClick={() => venture(view, 'undercity', send)} data-testid="venture-undercity">{t.table.dungeons.ventureUndercity}</button>
              )}
            </>}
            <button className={dungeonBtn} onClick={() => openDungeon({ player, ...(p.dungeon ? { dungeon: p.dungeon.id } : {}) })} data-testid="dungeon-plan-open">{t.table.dungeons.plan}</button>
          </li>
        )}
      </ul>
      {canAct && (
        <form className="pt-1 space-y-1" onSubmit={(e) => {
          e.preventDefault()
          const error = newMarkerError(p, draft, t)
          setDraftError(error || null)
          if (error !== null) return
          send({ type: 'playerCounter', target: player, name: draft.trim(), delta: 1 })
          setDraft('')
        }}>
          <div className="flex items-center gap-1">
            <input value={draft} maxLength={MARKER_NAME_MAX} placeholder={pl.newMarkerPlaceholder} aria-label={pl.newMarker}
              onChange={(e) => { setDraft(e.target.value); setDraftError(null) }}
              className="flex-1 min-w-0 h-7 tablet:h-11 px-2 rounded-md bg-dc-bg border border-dc-border text-dc-text placeholder:text-dc-muted focus:outline-none focus:border-dc-gold/60" />
            <button type="submit" className={rowBtn} aria-label={pl.addMarker}><Plus className={rowIcon} /></button>
          </div>
          {draftError && <p className="text-dc-red-light" role="alert" data-testid="marker-error">{draftError}</p>}
        </form>
      )}
    </div>
  )
}
