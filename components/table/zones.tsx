'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Arrival } from '@/lib/game/card-effects'
import { canSelectIn } from '@/lib/game/selection'
import type { Catalog, CardView, PlayerView, VisibleCard, ZoneRef } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { CardBack, type Lang } from './GameCard'
import { useLasso, type Box } from './lasso'
import { longPressClass, menuGesture, type MenuPoint } from './touch'
import { battlefieldStyle, cardSize, DEFAULT_TABLE_SETTINGS, type TableSettings } from '@/lib/table-settings'

/** Identifiant de dépôt d'une zone : « joueur:zone ». */
export const dropId = (ref: ZoneRef) => `${ref.player}:${ref.zone}`
/** Identifiant glissé pour la carte du dessus de la bibliothèque d'un joueur (inconnue du navigateur). */
export const topId = (player: string) => `top:${player}`

export type CardHandlers = {
  onDoubleClick: (id: string, zone: ZoneRef) => void
  /** Clic droit ou appui long sur une carte. */
  onContextMenu: (id: string, zone: ZoneRef, at: MenuPoint) => void
  onHover: (id: string | null) => void
  /** Toucher l'encart loyauté ou force/endurance d'une carte en jeu ; absent : encart en lecture seule. */
  onPtEdit?: (id: string, zone: ZoneRef, at: MenuPoint) => void
}

/** Sélection de plusieurs cartes (mon champ de bataille, ma main) : seulement sur mon plateau, pour un joueur. */
export type ZoneSelection = {
  ids: Set<string>
  /** Cartes emportées avec celle qu'on glisse : estompées. */
  lifted: Set<string>
  onSelect: (zone: ZoneRef, ids: string[], additive: boolean) => void
  onToggle: (zone: ZoneRef, id: string) => void
  onClear: () => void
}

export type ZoneProps = {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  handlers: CardHandlers
  /** Cartes déplaçables par l'utilisateur. */
  interactive: boolean
  /** Cartes à mettre en évidence (repères d'activité). */
  highlighted?: Set<string>
  /** Réglages d'affichage (quadrillage, couleur du fond, taille des cartes). */
  settings?: TableSettings
  /** Cartes qui viennent d'arriver en jeu, avec leur provenance (éclat d'un légendaire, retour du cimetière). */
  arriving?: Map<string, Arrival>
  /** Sélection de cartes ; absente : pas de rectangle de sélection (plateaux des adversaires, spectateur). */
  selection?: ZoneSelection
}

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

/** Carte du dessus de la bibliothèque d'un joueur, si celui qui regarde la connaît (révélée, regardée…). */
export const libraryTop = (view: PlayerView, player: string): VisibleCard | null =>
  view.players[player]?.zones.library.visible.find((v) => v.index === 0)?.card ?? null

/** Cible de dépôt d'une zone ; `key` : seconde cible pour la même zone (case Cim. de la colonne). */
export function useZone(ref: ZoneRef, key?: string) {
  const { setNodeRef, isOver } = useDroppable({ id: key ? `${dropId(ref)}:${key}` : dropId(ref), data: ref })
  return { setNodeRef, highlight: isOver ? 'ring-2 ring-dc-gold/60' : '' }
}

export function cardProps(id: string, zone: ZoneRef, props: ZoneProps) {
  const { handlers } = props
  return {
    id,
    from: zone,
    disabled: !props.interactive,
    highlight: props.highlighted?.has(id) ?? false,
    onDoubleClick: () => handlers.onDoubleClick(id, zone),
    onContextMenu: (at: MenuPoint) => handlers.onContextMenu(id, zone, at),
    onHover: (h: boolean) => handlers.onHover(h ? id : null),
    selected: props.selection?.ids.has(id) ?? false,
    faded: props.selection?.lifted.has(id) ?? false,
    onSelectClick: props.selection && canSelectIn(props.view.me, zone) ? () => props.selection?.onToggle(zone, id) : undefined,
  }
}

/** Rectangle de sélection d'une zone, si elle en permet un (ma zone, sélection fournie). */
function useZoneLasso(props: ZoneProps, ref: ZoneRef, onLongPress?: (at: MenuPoint) => void) {
  const enabled = !!props.selection && canSelectIn(props.view.me, ref)
  const lasso = useLasso({
    enabled,
    onSelect: (ids, additive) => props.selection?.onSelect(ref, ids, additive),
    onClear: () => props.selection?.onClear(),
    onLongPress,
  })
  return { ...lasso, enabled }
}

/** Le rectangle en cours de tracé, dans sa zone. */
function LassoBox({ box }: { box: Box | null }) {
  if (!box) return null
  return (
    <div className="absolute z-[6] pointer-events-none rounded-sm border border-sky-400 bg-sky-400/15" data-testid="lasso"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
  )
}

/** Ouverture de la modification de loyauté ou de force/endurance d'une carte en jeu, si la table la permet. */
export function ptEdit(handlers: CardHandlers, id: string, zone: ZoneRef): ((at: MenuPoint) => void) | undefined {
  const open = handlers.onPtEdit
  return open && ((at) => open(id, zone, at))
}

/**
 * Champ de bataille d'un joueur ; `corner` : contenu en bas à gauche (sa réserve de mana).
 * Le coin ne capte pas les événements (seul son contenu interactif les prend) : dépôt et glisser restent libres autour.
 */
export function Battlefield(props: ZoneProps & { label?: string; corner?: React.ReactNode }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'battlefield' }
  const { setNodeRef, highlight } = useZone(ref)
  const settings = props.settings ?? DEFAULT_TABLE_SETTINGS
  const size = cardSize(settings.cardScale)
  const lasso = useZoneLasso(props, ref)
  return (
    <div ref={setNodeRef} data-zone="battlefield" data-player={player} style={battlefieldStyle(settings)} onPointerDown={lasso.onPointerDown}
      className={`relative flex-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/40 ${lasso.enabled ? `touch-none ${longPressClass}` : ''} ${highlight}`}>
      <LassoBox box={lasso.box} />
      <span className="absolute top-2 left-3 text-dc-muted text-xs pointer-events-none">{props.label ?? 'Champ de bataille'}</span>
      {visible(view.players[player].zones.battlefield).map((card) => (
        <Draggable
          key={card.id}
          {...cardProps(card.id, ref, props)}
          className="absolute"
          style={{ ...size, left: `${card.x}%`, top: `${card.y}%`, transform: `translate(-50%, -50%) rotate(${(card.tapped ? 90 : 0) + (card.rotated ? 180 : 0)}deg)`, transition: 'transform 150ms' }}
        >
          <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} pt onPtEdit={ptEdit(props.handlers, card.id, ref)} effects={settings.cardEffects} arriving={props.arriving?.get(card.id)} abilityStyle={settings.abilityStyle} />
        </Draggable>
      ))}
      {props.corner && <div className="absolute bottom-1.5 left-1.5 z-[5] pointer-events-none">{props.corner}</div>}
    </div>
  )
}

/** Main : mes cartes face visible ; celle d'un autre en dos de carte (seulement leur nombre est connu). */
export function Hand(props: ZoneProps & { onZoneContextMenu?: (at: MenuPoint) => void }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'hand' }
  const { setNodeRef, highlight } = useZone(ref)
  const hand = view.players[player].zones.hand
  const press = menuGesture(props.onZoneContextMenu)
  // Avec la sélection, l'appui long dans le vide trace le rectangle ; relâché sans glisser, il ouvre le menu de la main.
  const lasso = useZoneLasso(props, ref, props.onZoneContextMenu)
  const gestures = lasso.enabled ? {
    onPointerDown: lasso.onPointerDown,
    onContextMenu: (e: React.MouseEvent) => {
      // Menu natif d'Android pendant l'appui long : ignoré, le menu s'ouvre au lever du doigt.
      if (lasso.touching()) return e.preventDefault()
      press.onContextMenu?.(e)
    },
  } : press
  return (
    <div
      ref={setNodeRef}
      data-zone="hand"
      data-player={player}
      className={`relative flex-1 min-w-0 min-h-0 flex items-center justify-center gap-1 px-4 py-2 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/60 ${longPressClass} ${lasso.enabled ? 'touch-none' : ''} ${highlight}`}
      {...gestures}
    >
      <LassoBox box={lasso.box} />
      <span className="absolute top-1 left-3 text-dc-muted text-xs pointer-events-none">Main ({hand.length})</span>
      {hand.map((card, i) =>
        card.hidden ? (
          <CardBack key={`h${i}`} className="h-[90%]" />
        ) : (
          // La carte peut rétrécir (minWidth) pour se chevaucher quand la main est pleine.
          <Draggable key={card.id} {...cardProps(card.id, ref, props)} className="h-[90%] hover:-translate-y-2 transition-transform" style={{ flex: '0 1 auto', minWidth: 24 }}>
            <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} className="h-full" />
          </Draggable>
        ),
      )}
    </div>
  )
}

/** Cartes affichées au plus dans la main compacte d'un adversaire. */
const COMPACT_HAND_MAX = 10

/**
 * Main d'un adversaire en bande fine (vue agrandie, Duel) : son nombre et de petits dos qui se chevauchent.
 * Reste une cible de dépôt (`data-zone="hand"`) ; une carte révélée s'y affiche face visible, avec son aperçu.
 */
export function OpponentHand(props: ZoneProps) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'hand' }
  const { setNodeRef, highlight } = useZone(ref)
  const hand = view.players[player].zones.hand
  const shown = hand.slice(0, COMPACT_HAND_MAX)
  return (
    <div
      ref={setNodeRef}
      data-zone="hand"
      data-player={player}
      className={`h-7 shrink-0 flex items-center gap-2 px-3 rounded-lg border border-dc-border bg-dc-surface/60 ${highlight}`}
    >
      <span className="text-dc-muted text-xs shrink-0">Main : {hand.length}</span>
      <div className="h-5 flex items-center">
        {shown.map((card, i) =>
          card.hidden ? (
            <CardBack key={`h${i}`} bare className={`h-full ${i > 0 ? '-ml-1.5' : ''}`} />
          ) : (
            <Draggable key={card.id} {...cardProps(card.id, ref, props)} className={`h-full ${i > 0 ? '-ml-1.5' : ''}`}>
              <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} className="h-full" />
            </Draggable>
          ),
        )}
      </div>
      {hand.length > COMPACT_HAND_MAX && <span className="text-dc-muted text-xs">+{hand.length - COMPACT_HAND_MAX}</span>}
    </div>
  )
}
