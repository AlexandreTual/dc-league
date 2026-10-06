'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { Crown, Flag } from 'lucide-react'
import { diffViews } from '@/lib/game/activity'
import { shortcutFor } from '@/lib/game/keyboard'
import { cardMenu, handMenu, libraryMenu, type MenuCommand, type MenuContext, type MenuEntry } from '@/lib/game/menus'
import type { ClientAction } from '@/lib/game/room'
import type { PlayerView, PlayerZone, Position, VisibleCard, ZoneRef } from '@/lib/game/types'
import ActivityFeed, { type ActivityLine } from './ActivityFeed'
import CardMenu, { type MenuItem } from './CardMenu'
import GameCard, { CardBack, type Lang } from './GameCard'
import LogPanel from './LogPanel'
import MyBoard from './MyBoard'
import OpponentBoard from './OpponentBoard'
import OpponentStrip from './OpponentStrip'
import OpponentsArea from './OpponentsArea'
import PlayerPill from './PlayerPill'
import PlayerPortrait from './PlayerPortrait'
import PileModal from './PileModal'
import PreviewPane from './PreviewPane'
import TokenModal from './TokenModal'
import TopBar, { barButton } from './TopBar'
import TableSettingsPanel from './TableSettings'
import ManaPool from './ManaPool'
import OracleModal from '@/components/OracleModal'
import { readLang, saveLang } from '@/lib/cards/lang'
import { DEFAULT_TABLE_SETTINGS, loadTableSettings, saveTableSettings, type TableSettings } from '@/lib/table-settings'
import type { GameSource } from './source'
import type { MenuPoint } from './touch'
import { libraryTop, type CardHandlers } from './zones'

/** Largeur / hauteur d'une carte (63 × 88 mm). */
const CARD_RATIO = 63 / 88

type PileState = {
  title: string
  player: string
  zone: 'library' | 'graveyard' | 'exile'
  mode: 'look' | 'search' | 'browse'
}

/** Toutes les cartes visibles de la vue, par identifiant (y compris celles regardées en bibliothèque). */
function visibleCards(view: PlayerView): Map<string, VisibleCard> {
  const map = new Map<string, VisibleCard>()
  for (const p of Object.values(view.players)) {
    const { library, ...zones } = p.zones
    for (const cards of Object.values(zones)) for (const c of cards) if (!c.hidden) map.set(c.id, c)
    for (const { card } of library.visible) map.set(card.id, card)
  }
  return map
}

/**
 * Zone visée : celle sous le pointeur ; à défaut (pointeur entre deux zones), celle que la carte recouvre le plus.
 * Une grande carte lâchée sur une petite zone de la colonne (commandement) ne tombe pas dans sa voisine.
 */
const collision: CollisionDetection = (args) => {
  const under = pointerWithin(args)
  return under.length > 0 ? under : rectIntersection(args)
}

/** Durées des repères d'activité. */
const HIGHLIGHT_MS = 1500
const LINE_MS = 4000
const MAX_LINES = 3

const sameZone = (a: ZoneRef, b: ZoneRef) => a.player === b.player && a.zone === b.zone

/** La table de jeu, pour le mode test comme pour le jeu en ligne. */
export default function Table({ source, notice }: { source: GameSource; notice?: React.ReactNode }) {
  const { view, me, catalogs } = source
  const [lang, setLang] = useState<Lang>('fr')
  // Taille de l'aperçu pendant le glisser : celle de la carte d'origine (hauteur ; largeur au format d'une carte).
  const [dragging, setDragging] = useState<{ id: string; from: ZoneRef; height: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[]; items?: MenuItem[]; card?: { id: string; zone: ZoneRef } } | null>(null)
  const [pile, setPile] = useState<PileState | null>(null)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [oracle, setOracle] = useState<{ owner: string; ref: number } | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [settings, setSettings] = useState<TableSettings>(DEFAULT_TABLE_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const shiftDown = useRef(false)
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const [lines, setLines] = useState<ActivityLine[]>([])
  const prevView = useRef<PlayerView | null>(null)
  const lineKey = useRef(0)
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>()

  const finished = source.online?.finished ?? false
  const status = source.online?.status ?? 'open'
  const canAct = me !== null && !finished && status === 'open'
  const cards = useMemo(() => visibleCards(view), [view])
  const menuCtx: MenuContext = { me, view, catalogs, lang, readOnly: !canAct }
  const send = source.send

  useEffect(() => setLang(readLang()), [])
  useEffect(() => setSettings(loadTableSettings()), [])
  const changeSettings = (next: TableSettings) => {
    setSettings(next)
    saveTableSettings(next)
  }

  // Repères d'activité : ce que les autres viennent de faire (rien à la connexion ni à la reconnexion).
  useEffect(() => {
    if (status !== 'open') {
      prevView.current = null
      return
    }
    const prev = prevView.current
    prevView.current = view
    const { changed, lines: added } = diffViews(prev, view, me)
    if (added.length === 0) return
    if (changed.length > 0) {
      setHighlighted(new Set(changed))
      clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlighted(new Set()), HIGHLIGHT_MS)
    }
    const fresh = added.map((l) => ({ key: ++lineKey.current, author: view.players[l.actor]?.name ?? '', text: l.text }))
    setLines((current) => [...current, ...fresh].slice(-MAX_LINES))
    const keys = new Set(fresh.map((l) => l.key))
    setTimeout(() => setLines((current) => current.filter((l) => !keys.has(l.key))), LINE_MS)
  }, [view, me, status])

  useEffect(() => {
    const track = (e: KeyboardEvent) => { shiftDown.current = e.shiftKey }
    window.addEventListener('keydown', track)
    window.addEventListener('keyup', track)
    return () => {
      window.removeEventListener('keydown', track)
      window.removeEventListener('keyup', track)
    }
  }, [])

  const run = useCallback((commands: MenuCommand[]) => {
    for (const command of commands) {
      if (command.kind === 'action') send(command.action)
      else if (command.kind === 'openPile') setPile({ title: command.title, player: command.player, zone: command.zone, mode: command.mode })
      else if (command.kind === 'oracle') setOracle({ owner: command.owner, ref: command.ref })
      else {
        const answer = prompt(command.question, String(command.fallback))
        const n = answer === null ? NaN : Number.parseInt(answer, 10)
        if (Number.isFinite(n) && n > 0) run(command.then(n))
      }
    }
  }, [send])

  const toItems = (entries: MenuEntry[]): MenuItem[] =>
    entries.map((e) => {
      if (e.kind === 'item') return { kind: 'action', label: e.label, onSelect: () => run(e.commands) }
      if (e.kind === 'stepper') {
        const set = e.set
        return { kind: 'stepper', label: e.label, value: e.value, onChange: (d: number) => run([d < 0 ? e.minus : e.plus]),
          onSet: set && ((n: number) => run(set(n))) }
      }
      return e
    })

  /** Menu d'une carte reconstruit à chaque rendu : les marqueurs affichés (et l'écart d'une valeur tapée) suivent la partie. */
  const liveEntries = (m: { entries: MenuEntry[]; card?: { id: string; zone: ZoneRef } }): MenuEntry[] => {
    const { id, zone } = m.card ?? {}
    if (!id || !zone || zone.zone === 'library') return m.entries
    const card = cards.get(id)
    const z = zone.zone
    if (!card || !view.players[zone.player]?.zones[z].some((c) => !c.hidden && c.id === id)) return m.entries
    const fresh = cardMenu(menuCtx, card, zone)
    return fresh.length > 0 ? fresh : m.entries
  }

  const openMenu = (entries: MenuEntry[], at: MenuPoint) => {
    if (entries.length > 0) setMenu({ x: at.clientX, y: at.clientY, entries })
  }

  /** Regard : ordre choisi dans la fenêtre, appliqué à la fermeture (bouton, clic à côté ou Échap). */
  const pileOrder = useRef<string[] | null>(null)

  const closePile = useCallback((shuffle: boolean) => {
    if (pile?.zone === 'library' && pile.mode !== 'browse') {
      // Seules comptent les cartes encore regardées (une carte mise dessous ou jouée n'y est plus).
      const seen = view.players[pile.player].zones.library.visible.map((v) => v.card.id)
      const order = (pileOrder.current ?? []).filter((id) => seen.includes(id))
      const current = seen.filter((id) => order.includes(id))
      if (pile.mode === 'look' && !shuffle && order.some((id, i) => id !== current[i])) {
        send({ type: 'reorderTop', target: pile.player, ids: order })
      }
      send({ type: 'endLook', target: pile.player, shuffle })
    }
    pileOrder.current = null
    setPile(null)
  }, [pile, send, view])

  // Souris : glisser dès 5 px. Doigt : appui de 200 ms sans bouger de plus de 8 px (sinon c'est un défilement ou un toucher).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Au doigt, la carte « survolée » reste affichée (pas de mouseleave) : le toucher suivant masque l'aperçu.
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (e.pointerType !== 'mouse') setHovered(null) }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e)
      if (!shortcut) return
      if (shortcut === 'close') {
        setMenu(null)
        if (pile) closePile(false)
        setTokenOpen(false)
        setOracle(null)
        setLogOpen(false)
        setSettingsOpen(false)
        return
      }
      // Pas de raccourci de jeu tant qu'une fenêtre est ouverte, ni pour un spectateur.
      if (pile || tokenOpen || oracle || menu || !canAct) return
      e.preventDefault()
      if (shortcut === 'undo') return source.undo()
      const actions = {
        draw: { type: 'draw', count: 1 },
        untapAll: { type: 'untapAll' },
        nextTurn: { type: 'endTurn' },
        shuffle: { type: 'shuffle' },
        mulligan: { type: 'mulligan' },
      } satisfies Record<Exclude<typeof shortcut, 'undo' | 'close'>, ClientAction>
      send(actions[shortcut])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send, source, closePile, pile, tokenOpen, oracle, menu, canAct])

  const handlers: CardHandlers = {
    onDoubleClick: (id, zone) => {
      if (!canAct) return
      if (id.startsWith('top:')) return send({ type: 'draw', count: 1 })
      if (zone.zone === 'battlefield') send({ type: 'tap', id })
      else if (zone.zone === 'hand' && zone.player === me) send({ type: 'move', id, to: { player: me, zone: 'battlefield' }, x: 50, y: 50 })
    },
    onContextMenu: (id, zone, at) => {
      const card = cards.get(id)
      const entries = card ? cardMenu(menuCtx, card, zone) : []
      if (entries.length > 0) setMenu({ x: at.clientX, y: at.clientY, entries, card: { id, zone } })
    },
    onHover: (id) => setHovered(id),
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    // offsetHeight ignore la rotation d'une carte engagée, contrairement au rectangle mesuré par dnd-kit.
    const node = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`)
    setDragging({ id, from: e.active.data.current?.from as ZoneRef, height: node?.offsetHeight || 134 })
  }

  function onDragEnd(e: DragEndEvent) {
    const height = dragging?.height ?? 0
    setDragging(null)
    const to = e.over?.data.current as ZoneRef | undefined
    const from = e.active.data.current?.from as ZoneRef | undefined
    const id = String(e.active.id)
    if (!to || !from || !me) return
    const placement: { x?: number; y?: number; position?: Position } = {}
    if (to.zone === 'battlefield') {
      const rect = e.active.rect.current.translated
      const zone = e.over!.rect
      if (!rect) return
      // Centre de l'aperçu tel que le joueur le voit (posé au coin haut-gauche du rectangle déplacé).
      const width = height * CARD_RATIO
      placement.x = Math.round(((rect.left + width / 2 - zone.left) / zone.width) * 1000) / 10
      placement.y = Math.round(((rect.top + height / 2 - zone.top) / zone.height) * 1000) / 10
    } else if (to.zone === 'library') {
      placement.position = shiftDown.current ? 'bottom' : 'top'
    } else if (sameZone(from, to)) {
      return
    }
    if (id.startsWith('top:')) send({ type: 'moveTop', to, ...placement })
    else send({ type: 'move', id, to, ...placement })
  }

  const pileCards: VisibleCard[] = !pile ? [] : pile.zone === 'library'
    ? view.players[pile.player].zones.library.visible.map((v) => v.card)
    : view.players[pile.player].zones[pile.zone].filter((c): c is VisibleCard => !c.hidden).reverse()

  const mine = me ? view.players[me] : null
  const oracleEntry = oracle ? catalogs[oracle.owner]?.entries.find((e) => e.ref === oracle.ref) : undefined
  const zoneProps = { view, catalogs, lang, handlers, interactive: canAct, highlighted, settings }
  // Adversaires dans l'ordre des places ; pour un spectateur, tous les joueurs.
  const opponents = Object.keys(view.players).filter((p) => p !== me)
  /** Commandes de l'hôte : passer le tour du joueur actif (s'il n'est pas l'hôte), éliminer, clore. */
  const hostItems = (): MenuItem[] => {
    const host = source.online?.hostCommands
    if (!host) return []
    const name = (p: string) => view.players[p].name
    const items: MenuItem[] = [{ kind: 'title', label: 'Hôte' }]
    if (view.activePlayer !== me) {
      items.push({ kind: 'action', label: `Passer le tour de ${name(view.activePlayer)}`, onSelect: () => host.passTurn(view.activePlayer) })
    }
    for (const p of opponents.filter((p) => !view.players[p].eliminated)) {
      items.push({ kind: 'action', label: `Éliminer ${name(p)}`, onSelect: () => confirm(`Éliminer ${name(p)} ?`) && host.eliminate(p) })
    }
    items.push({ kind: 'separator' }, { kind: 'action', label: 'Clore la partie', onSelect: () => confirm('Clore la partie sans vainqueur ?') && host.close() })
    return items
  }

  /** Pastille d'un adversaire (bandeau, plateau agrandi). */
  const panelFor = (player: string, onTitleClick?: () => void) => (
    <PlayerPill view={view} player={player} catalogs={catalogs} lang={lang} host={source.online?.host} online={source.online?.players}
      canAct={canAct} send={send} onTitleClick={onTitleClick} />
  )

  /** Ligne portrait de ma colonne (vie en gros) ; bulle ouverte vers le haut. */
  const portraitFor = (player: string) => (
    <PlayerPortrait view={view} player={player} catalogs={catalogs} lang={lang} host={source.online?.host} online={source.online?.players}
      canAct={canAct} send={send} size="column" up />
  )

  return (
    <div className="relative h-full flex flex-col">
      <TopBar
        back={source.local ? { href: `/decks/${source.local.deckId}`, label: source.local.deckName } : { href: '/salon', label: 'Salon' }}
        turn={view.turn}
        activeName={source.mode === 'online' ? view.players[view.activePlayer]?.name : undefined}
        lang={lang}
        canAct={canAct}
        canUndo={canAct && source.canUndo}
        canEndTurn={canAct && (source.mode === 'local' || view.activePlayer === me)}
        onNextTurn={() => send({ type: 'endTurn' })}
        onDraw={source.mode === 'online' && me ? () => send({ type: 'draw', count: 1 }) : undefined}
        onLang={() => {
          const next = lang === 'fr' ? 'en' : 'fr'
          setLang(next)
          saveLang(next)
        }}
        onUndo={source.undo}
        onToken={() => setTokenOpen(true)}
        onLog={() => setLogOpen((open) => !open)}
        onSettings={() => setSettingsOpen((open) => !open)}
        mana={source.mode === 'local' && mine ? <ManaPool pool={mine.mana} keep={mine.keepMana} editable={canAct} send={send} /> : undefined}
        onNewGame={source.local ? () => confirm('Commencer une nouvelle partie ?') && source.local?.newGame() : undefined}
        extra={source.online && me && !finished && (
          <>
            {source.online.hostCommands && (
              <button className={barButton} onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, entries: [], items: hostItems() })}>
                <Crown className="w-3.5 h-3.5 text-dc-gold" /> Hôte
              </button>
            )}
            {!mine?.eliminated && (
              <button className={barButton} onClick={() => confirm('Abandonner la partie ?') && source.online?.concede()}>
                <Flag className="w-3.5 h-3.5" /> Abandonner
              </button>
            )}
          </>
        )}
      />

      {notice}

      {status !== 'open' && (
        <div className="px-3 py-1.5 text-sm bg-dc-red/30 border-b border-dc-red-light/40 text-dc-text" data-testid="reconnecting">
          {status === 'connecting' ? 'Connexion…' : 'Reconnexion…'}
        </div>
      )}
      {!me && (
        <div className="px-3 py-1.5 text-sm bg-dc-blue/20 border-b border-dc-border text-dc-text" data-testid="spectator">Tu regardes cette partie</div>
      )}
      {finished && (
        <div className="px-3 py-2 font-fantasy text-dc-gold bg-dc-gold/10 border-b border-dc-gold/30" data-testid="finished">
          {source.online?.winner ? `Victoire de ${view.players[source.online.winner]?.name ?? '?'}` : 'Partie close'}
        </div>
      )}

      {mine && !mine.kept && canAct && (
        <div className="px-3 py-2 text-sm bg-dc-gold/10 border-b border-dc-gold/30 text-dc-gold flex items-center gap-3" data-testid="mulligan-banner">
          <span>
            {mine.mulligans === 0 ? 'Main de départ' : `Mulligan n°${mine.mulligans}`}
            {mine.mulligans > 0 && ' : mets au-dessous les cartes convenues (menu de la carte : « Mettre au-dessous », ou Maj + glisser), puis Garder'}
          </span>
          <button className="px-3 py-1 rounded-lg bg-dc-gold/20 border border-dc-gold/40" onClick={() => send({ type: 'keep' })}>Garder</button>
          <button className="px-3 py-1 rounded-lg border border-dc-gold/40" onClick={() => send({ type: 'mulligan' })}>Mulligan</button>
        </div>
      )}

      <div className="relative flex-1 min-h-0 flex flex-col">
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          {opponents.length > 0 && (
            <div className={`${me ? `${opponents.length === 1 ? 'h-[40%]' : 'h-[38%]'} shrink-0` : 'flex-1'} min-h-0 px-2 pt-2`}>
              <OpponentsArea
                view={view}
                players={opponents}
                renderStrip={(p, focus) => (
                  <OpponentStrip
                    view={view} player={p} catalogs={catalogs} lang={lang} handlers={handlers} highlighted={highlighted}
                    panel={panelFor(p, focus)}
                    onPile={(zone, title) => setPile({ title: `${title} de ${view.players[p].name}`, player: p, zone, mode: 'browse' })}
                    onLibraryMenu={(at) => openMenu(libraryMenu(menuCtx, p), at)}
                  />
                )}
                renderBoard={(p) => (
                  <OpponentBoard
                    {...zoneProps} player={p} me={me}
                    panel={panelFor(p)}
                    onLibraryMenu={(at) => openMenu(libraryMenu(menuCtx, p), at)}
                    onPile={(zone, title) => setPile({ title, player: p, zone, mode: 'browse' })}
                  />
                )}
              />
            </div>
          )}
          {me && (
            <MyBoard
              {...zoneProps}
              player={me}
              me={me}
              portrait={portraitFor(me)}
              onLibraryMenu={(at) => openMenu(libraryMenu(menuCtx, me), at)}
              onHandMenu={(at) => openMenu(handMenu(menuCtx), at)}
              onPile={(zone, title) => setPile({ title, player: me, zone, mode: 'browse' })}
            />
          )}
          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div className="pointer-events-none" style={{ height: dragging.height, width: dragging.height * CARD_RATIO }} data-testid="drag-overlay">
                {(() => {
                  // Carte du dessus : face visible si je la connais, dos sinon.
                  const shown = dragging.id.startsWith('top:') ? libraryTop(view, dragging.from.player)
                    : dragging.from.zone === 'library' ? null : cards.get(dragging.id)
                  return shown
                    ? <GameCard card={shown} catalog={catalogs[shown.owner]} lang={lang} className="h-full" />
                    : <CardBack className="h-full" />
                })()}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        <ActivityFeed lines={lines} error={source.error} />
        {logOpen && <LogPanel view={view} onClose={() => setLogOpen(false)} />}
      </div>
      {!dragging && <PreviewPane card={hovered ? cards.get(hovered) ?? null : null} catalog={catalogs[cards.get(hovered ?? '')?.owner ?? '']} lang={lang} />}

      {menu && <CardMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menu.items ?? toItems(liveEntries(menu))} />}
      {pile && (
        <PileModal
          key={`${pile.player}-${pile.zone}-${pile.mode}`}
          title={pile.title}
          zone={pile.zone}
          cards={pileCards}
          searchable={pile.mode !== 'look'}
          shuffleDefault={pile.zone === 'library' ? pile.mode === 'search' : null}
          catalogs={catalogs}
          lang={lang}
          readOnly={!canAct}
          onMove={(card: VisibleCard, zone: PlayerZone, position?: Position) => {
            // Hors du champ de bataille, une carte va toujours chez son propriétaire.
            const to = { player: zone === 'battlefield' ? me! : card.owner, zone }
            send(position ? { type: 'move', id: card.id, to, position } : { type: 'move', id: card.id, to })
          }}
          onReorder={pile.mode === 'look' ? (ids) => { pileOrder.current = ids } : undefined}
          onClose={closePile}
        />
      )}
      {tokenOpen && (
        <TokenModal deckTokens={source.deckTokens} onCreate={(token) => send({ type: 'createToken', token, x: 50, y: 50 })} onClose={() => setTokenOpen(false)} />
      )}
      {oracleEntry && <OracleModal en={oracleEntry.en} fr={oracleEntry.fr} onClose={() => setOracle(null)} />}
      {settingsOpen && <TableSettingsPanel settings={settings} onChange={changeSettings} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
