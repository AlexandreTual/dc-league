'use client'

import { useState } from 'react'
import { Castle, X } from 'lucide-react'
import { mapPoint } from '@/lib/game/dungeon-fx'
import { DUNGEON_IDS, DUNGEONS, VENTURE_DUNGEONS, dungeonDone, roomOf, rowsOf, ventureStep, type DungeonId } from '@/lib/game/dungeons'
import type { ClientAction } from '@/lib/game/room'
import type { PlayerView } from '@/lib/game/types'
import type { DungeonRequest } from './dungeon'
import { useDungeonFx } from './useDungeonFx'

/** Hauteur d'un étage du plan (px). */
const ROW = 84
/** Largeur d'une salle, en % du plan. */
const ROOM_WIDTH = 31
const COLORS = ['#c9a84c', '#5fa8d3', '#d36b5f', '#7fbf6a', '#b07fd3']

const action = 'px-4 h-9 tablet:h-11 rounded-lg border text-sm disabled:opacity-40'

/** Couleur d'un joueur sur le plan : selon sa place dans l'ordre du tour. */
const colorOf = (view: PlayerView, player: string) => {
  const i = (view.turnOrder ?? []).indexOf(player)
  return COLORS[(i < 0 ? Object.keys(view.players).indexOf(player) : i) % COLORS.length]
}

/** Jeton d'un joueur sur le plan : il glisse jusqu'à sa nouvelle salle, qui s'allume. */
function MapToken({ view, player, index, animate }: { view: PlayerView; player: string; index: number; animate: boolean }) {
  const p = view.players[player]
  const position = p.dungeon!
  const fx = useDungeonFx(position, p.dungeonsDone ?? 0, animate)
  const { x, y } = mapPoint(position)
  // Calque de la taille du plan déplacé en % de lui-même : le jeton se place (et glisse) avec `transform` seulement.
  return (
    <div className={`pointer-events-none absolute inset-0 ${fx?.glide ? 'dungeon-glide' : ''}`} style={{ transform: `translate(${x}%, ${y}%)` }}
      data-token={player} data-token-room={position.room}>
      {fx && <span key={fx.n} className="dungeon-lit absolute left-0 top-0 h-16 rounded-lg -translate-x-1/2 -translate-y-1/2" style={{ width: `${ROOM_WIDTH}%` }} />}
      <span className="absolute top-0 w-6 h-6 -mt-8 rounded-full border-2 border-dc-bg flex items-center justify-center text-[11px] font-bold text-[#1a1408] shadow-card"
        style={{ left: `${ROOM_WIDTH / 2 - 3}%`, marginLeft: -index * 14, background: colorOf(view, player) }} title={p.name}>
        {p.name.slice(0, 1).toUpperCase()}
      </span>
    </div>
  )
}

/**
 * Plan des donjons : onglets des quatre donjons, salles en étages reliées, jetons des joueurs, texte de la salle choisie.
 * Quand c'est à moi d'explorer (`request.mode`), le choix à faire : donjon où entrer, ou salle suivante.
 */
export default function DungeonMap({ view, request, canAct, animate, send, onClose }: {
  view: PlayerView
  request: DungeonRequest
  canAct: boolean
  animate: boolean
  send: (action: ClientAction) => void
  onClose: () => void
}) {
  const me = view.players[view.me] ? view.me : null
  const [mode, setMode] = useState(request.mode)
  const step = me && canAct && mode ? ventureStep(view.players[me].dungeon, mode) : null
  const focus = request.player ? view.players[request.player]?.dungeon : undefined
  const [tab, setTab] = useState<DungeonId>(
    request.dungeon ?? (step?.kind === 'advance' ? step.dungeon : step?.kind === 'enter' ? 'undercity' : focus?.id) ?? (step ? 'phandelver' : 'undercity'),
  )
  const dungeon = DUNGEONS[tab]
  const here = (player: string) => view.players[player]?.dungeon?.id === tab
  const players = Object.keys(view.players).filter(here)
  const [picked, setPicked] = useState<string | null>(null)
  const next = step?.kind === 'advance' && step.dungeon === tab ? step.next : []
  const own = (player: string | undefined) => (player && here(player) ? view.players[player].dungeon!.room : null)
  const selected = roomOf(tab, picked ?? (next.length > 0 ? null : own(request.player) ?? own(me ?? undefined)) ?? '') ?? (next[0] ? roomOf(tab, next[0])! : dungeon.rooms[0])
  const rows = rowsOf(tab)
  const point = (id: string) => mapPoint({ id: tab, room: id })
  const undercity = mode === 'undercity' ? { undercity: true } : {}
  const done = (fn: () => void) => () => { fn(); onClose() }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-dc-border bg-dc-surface p-4 space-y-3 shadow-card"
        role="dialog" aria-label="Donjons" onClick={(e) => e.stopPropagation()} data-testid="dungeon-map">
        <div className="flex items-center gap-2">
          <Castle className="w-4 h-4 text-dc-gold" />
          <h2 className="font-fantasy text-dc-gold">Donjons</h2>
          <button onClick={onClose} className="ml-auto w-8 h-8 tablet:w-11 tablet:h-11 flex items-center justify-center text-dc-muted hover:text-dc-text" aria-label="Fermer les donjons">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist">
          {DUNGEON_IDS.map((id) => {
            const count = Object.keys(view.players).filter((p) => view.players[p].dungeon?.id === id).length
            return (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setPicked(null) }} data-dungeon-tab={id}
                className={`px-2.5 h-8 tablet:h-11 rounded-lg border text-xs ${tab === id ? 'border-dc-gold bg-dc-gold/15 text-dc-gold' : 'border-dc-border text-dc-text hover:border-dc-gold/50'}`}>
                {DUNGEONS[id].short}{count > 0 && <span className="ml-1 text-dc-muted">({count})</span>}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-dc-text"><span className="font-fantasy text-dc-gold">{dungeon.name}</span> <span className="text-dc-muted text-xs">({dungeon.nameEn})</span></p>

        <div className="relative mx-1" style={{ height: rows * ROW }} data-testid="dungeon-plan">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {dungeon.rooms.flatMap((r) => r.next.map((n) => {
              const [a, b] = [point(r.id), point(n)]
              const open = own(me ?? undefined) === r.id && next.includes(n)
              return <line key={`${r.id}-${n}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={open ? '#f0d080' : '#4a4458'} strokeWidth={open ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
            }))}
          </svg>
          {dungeon.rooms.map((r) => {
            const { x, y } = point(r.id)
            const reachable = next.includes(r.id)
            const occupied = players.some((p) => view.players[p].dungeon!.room === r.id)
            return (
              <button key={r.id} onClick={() => setPicked(r.id)} data-room={r.id} data-next={reachable || undefined} aria-pressed={selected.id === r.id}
                className={`absolute h-16 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-1.5 py-1 text-left overflow-hidden
                  ${reachable ? 'border-dc-gold ring-2 ring-dc-gold/60' : occupied ? 'border-dc-gold/70' : 'border-dc-border'}
                  ${selected.id === r.id ? 'bg-dc-surface shadow-[inset_0_0_0_1px_rgba(201,168,76,0.6)]' : 'bg-dc-bg'}`}
                style={{ left: `${x}%`, top: `${y}%`, width: `${ROOM_WIDTH}%` }}>
                <span className="block text-[11px] font-semibold text-dc-text leading-tight truncate">{r.name}</span>
                <span className="block text-[10px] text-dc-muted leading-tight line-clamp-2">{r.text}</span>
              </button>
            )
          })}
          {players.map((p) => <MapToken key={p} view={view} player={p} index={players.filter((o) => view.players[o].dungeon!.room === view.players[p].dungeon!.room).indexOf(p)} animate={animate} />)}
        </div>

        <div className="rounded-lg border border-dc-border bg-dc-bg/60 p-3 space-y-1" data-testid="dungeon-room">
          <p className="text-sm font-semibold text-dc-text">{selected.name} <span className="text-xs font-normal text-dc-muted">({selected.nameEn})</span></p>
          <p className="text-sm text-dc-text" data-testid="dungeon-room-text">{selected.text}</p>
          {selected.next.length === 0 && <p className="text-xs text-dc-gold">Dernière salle : le donjon est terminé.</p>}
          {players.filter((p) => view.players[p].dungeon!.room === selected.id).map((p) => (
            <p key={p} className="text-xs text-dc-muted">
              <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: colorOf(view, p) }} />
              {view.players[p].name}{dungeonDone(view.players[p].dungeon!) ? ' — donjon terminé' : ' est ici'}
            </p>
          ))}
        </div>

        {me && canAct && (
          <div className="flex flex-wrap items-center gap-2" data-testid="dungeon-actions">
            {!step && <button className={`${action} border-dc-gold/50 text-dc-gold`} onClick={() => setMode('dungeon')} data-testid="dungeon-venture">Explorer le donjon</button>}
            {step?.kind === 'choose' && (VENTURE_DUNGEONS.includes(tab)
              ? <button className={`${action} border-dc-gold bg-dc-gold/20 text-dc-gold`} onClick={done(() => send({ type: 'venture', dungeon: tab }))} data-testid="dungeon-enter">Entrer dans ce donjon</button>
              : <p className="text-xs text-dc-muted">On n’entre dans Les Souterrains qu’avec l’initiative : choisis un autre donjon.</p>)}
            {step?.kind === 'enter' && (
              <button className={`${action} border-dc-gold bg-dc-gold/20 text-dc-gold`} onClick={done(() => send({ type: 'venture', undercity: true }))} data-testid="dungeon-enter">Entrer dans Les Souterrains</button>
            )}
            {step?.kind === 'advance' && (
              step.dungeon !== tab ? <p className="text-xs text-dc-muted">Ton donjon en cours : {DUNGEONS[step.dungeon].name}.</p>
                : next.includes(selected.id)
                  ? <button className={`${action} border-dc-gold bg-dc-gold/20 text-dc-gold`} onClick={done(() => send({ type: 'venture', room: selected.id, ...undercity }))} data-testid="dungeon-advance">Avancer ici : {selected.name}</button>
                  : <p className="text-xs text-dc-muted">Choisis la salle suivante (en surbrillance).</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
