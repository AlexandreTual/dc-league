'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { Crown, ExternalLink, Flag, Undo2, Video, X } from 'lucide-react'
import { diffViews } from '@/lib/game/activity'
import { cardInfo } from '@/lib/game/apply'
import { arrivals, printedKeywordsOf, type Arrival } from '@/lib/game/card-effects'
import { appliesPerCard, cardShortcutCommands, DEFAULT_BINDINGS, isCardShortcut, loadBindings, menuHints, movesCard, saveBindings, selectionShortcutCommands, shortcutFor, zoneOf, type Bindings } from '@/lib/game/keyboard'
import { cardMenu, handMenu, libraryMenu, statMenu, type MenuCommand, type MenuContext, type MenuEntry } from '@/lib/game/menus'
import { liveSelection, rowPlaces, selectIds, selectionMenu, shiftedPlaces, toggleId, type OrderRequest, type Selection } from '@/lib/game/selection'
import type { ClientAction } from '@/lib/game/room'
import type { PlayerView, PlayerZone, Position, VisibleCard, ZoneRef } from '@/lib/game/types'
import ActivityFeed, { type ActivityLine } from './ActivityFeed'
import CardMenu, { type MenuItem } from './CardMenu'
import DiceModal from './DiceModal'
import DungeonHost from './DungeonHost'
import GameCard, { CardBack, type Lang } from './GameCard'
import LogPanel from './LogPanel'
import MyBoard from './MyBoard'
import OrderModal from './OrderModal'
import OpponentBoard from './OpponentBoard'
import OpponentStrip from './OpponentStrip'
import OpponentsArea from './OpponentsArea'
import PlayerHeader from './PlayerHeader'
import PlayerPortrait from './PlayerPortrait'
import PileModal, { PILE_PANEL, PILE_SLOT } from './PileModal'
import PreviewPane from './PreviewPane'
import StartDraw from './StartDraw'
import TokenModal from './TokenModal'
import { AbilitiesModal } from './abilities'
import GameTimer from './GameTimer'
import TopBar, { barButton } from './TopBar'
import TableSettingsPanel from './TableSettings'
import ShortcutsModal from './ShortcutsModal'
import AnimationsModal from './AnimationsModal'
import DiceTray from './DiceTray'
import HolderFlights from './HolderFlights'
import VictoryScreen from './VictoryScreen'
import { usePlayerFx } from './usePlayerFx'
import ManaPool from './ManaPool'
import VisioPanel from './visio/VisioPanel'
import { useVisio } from './visio/useVisio'
import OracleModal from '@/components/OracleModal'
import { aiCardRef, useAi } from '@/components/ai/AiProvider'
import { readLang, saveLang } from '@/lib/cards/lang'
import { DEFAULT_TABLE_SETTINGS, loadTableSettings, saveTableSettings, type TableSettings } from '@/lib/table-settings'
import type { GameSource } from './source'
import { boardWindowName } from './boardWindows'
import { useBoardWindows } from './useBoardWindows'
import type { MenuPoint } from './touch'
import { libraryTop, type CardHandlers, type ZoneSelection } from './zones'
import { cardPreview } from '@/lib/game/card-preview'

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
  // Fenêtre d'une pile encore affichée pendant le glisser (regard) : seules ses cartes sont des cibles (réordonner).
  const slots = under.filter((c) => String(c.id).startsWith(PILE_SLOT))
  if (slots.length > 0) return slots
  if (under.some((c) => c.id === PILE_PANEL)) return []
  return under.length > 0 ? under : rectIntersection(args)
}

/** Durées des repères d'activité. */
const HIGHLIGHT_MS = 1500
/** Durée des effets d'arrivée en jeu (un peu plus que l'entrée d'un commandant, 1,7 s, ou le retour du cimetière, 1,6 s ; l'éclat d'un légendaire dure 1,1 s). */
const ARRIVAL_MS = 2000
const LINE_MS = 4000
const MAX_LINES = 3

const sameZone = (a: ZoneRef, b: ZoneRef) => a.player === b.player && a.zone === b.zone

/**
 * La table de jeu, pour le mode test comme pour le jeu en ligne.
 * `boardWindow` : fenêtre à part qui n'affiche que le plateau de cet adversaire (partie en ligne, ordinateur).
 */
export default function Table({ source, notice, boardWindow }: {
  source: GameSource
  notice?: React.ReactNode
  boardWindow?: { player: string; onReturn(): void }
}) {
  const { view, me, catalogs } = source
  // Plateaux d'adversaires sortis dans des fenêtres à part : seulement depuis la table principale d'une partie en ligne.
  const windows = useBoardWindows(source.online && !boardWindow ? source.online.tableId : null)
  const [lang, setLang] = useState<Lang>('fr')
  // Taille de l'aperçu pendant le glisser : celle de la carte d'origine (hauteur ; largeur au format d'une carte).
  // `group` : cartes sélectionnées emportées avec celle qu'on glisse.
  const [dragging, setDragging] = useState<{ id: string; from: ZoneRef; height: number; group?: string[] } | null>(null)
  /** Cartes sélectionnées (rectangle tracé sur mon champ de bataille ou ma main). */
  const [selection, setSelection] = useState<Selection | null>(null)
  /** Fenêtre « Ordre des cartes » d'un groupe sélectionné, avant de le poser sur une pile. */
  const [ordering, setOrdering] = useState<OrderRequest | null>(null)
  // `pt` : menu de l'encart loyauté ou force/endurance (seulement ces réglages) plutôt que le menu complet de la carte.
  const [menu, setMenu] = useState<{
    x: number; y: number; entries: MenuEntry[]; items?: MenuItem[]; card?: { id: string; zone: ZoneRef; pt?: boolean }
    /** Ouvert au doigt : l'image de la carte est dans le menu. */
    touch?: boolean
    /** Menu de la bibliothèque de ce joueur : l'image est celle de la carte du dessus, si elle est visible. */
    library?: string
  } | null>(null)
  const [pile, setPile] = useState<PileState | null>(null)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [diceOpen, setDiceOpen] = useState(false)
  const [diceCount, setDiceCount] = useState(1)
  // En ligne, à l'ouverture d'une partie qui commence (tour 1, ma main pas encore gardée) : qui commence.
  const [startDraw, setStartDraw] = useState(() => source.mode === 'online' && me !== null && Object.keys(view.players).length > 1
    && view.turn === 1 && view.players[me]?.kept === false && (view.turnOrder?.length ?? 0) > 0)
  const [oracle, setOracle] = useState<{ owner: string; ref: number } | null>(null)
  /** Carte dont la fenêtre « Capacités » est ouverte. */
  const [abilitiesFor, setAbilitiesFor] = useState<string | null>(null)
  /** Fenêtre « Effet » ouverte : permanents visés (toutes mes créatures, ou la sélection) et leur description. */
  const [effectFor, setEffectFor] = useState<{ ids: string[]; title: string } | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [settings, setSettings] = useState<TableSettings>(DEFAULT_TABLE_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bindings, setBindings] = useState<Bindings>(DEFAULT_BINDINGS)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [animationsOpen, setAnimationsOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const shiftDown = useRef(false)
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const [arriving, setArriving] = useState<Map<string, Arrival>>(new Map())
  const arrivingTimer = useRef<ReturnType<typeof setTimeout>>()
  const [lines, setLines] = useState<ActivityLine[]>([])
  const prevView = useRef<PlayerView | null>(null)
  const lineKey = useRef(0)
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>()

  const finished = source.online?.finished ?? false
  const status = source.online?.status ?? 'open'
  const canAct = me !== null && !finished && status === 'open'
  // Visio : table principale d'une partie en ligne, joueurs assis, serveur de jeu qui la relaie.
  const playerFx = usePlayerFx({ view, me, status, effects: settings.cardEffects, finished, winner: source.online?.winner ?? null })
  const visio = useVisio(boardWindow ? undefined : source.online?.visio, me, source.online?.players ?? [], status)
  const cards = useMemo(() => visibleCards(view), [view])
  const ai = useAi()
  const menuCtx: MenuContext = { me, view, catalogs, lang, readOnly: !canAct, ai: ai !== null }
  const send = source.send
  // Seules restent sélectionnées les cartes encore dans leur zone ; rien pour un spectateur ou une partie finie.
  const live = canAct ? liveSelection(view, selection) : null

  useEffect(() => setLang(readLang()), [])
  useEffect(() => setSettings(loadTableSettings()), [])
  useEffect(() => setBindings(loadBindings()), [])
  const changeBindings = useCallback((next: Bindings) => {
    setBindings(next)
    saveBindings(next)
  }, [])
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
    const entered = arrivals(prev, view)
    if (entered.size > 0) {
      setArriving(entered)
      clearTimeout(arrivingTimer.current)
      arrivingTimer.current = setTimeout(() => setArriving(new Map()), ARRIVAL_MS)
    }
    const { changed, lines: added } = diffViews(prev, view, me)
    if (added.length === 0) return
    if (changed.length > 0) {
      setHighlighted(new Set(changed))
      clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlighted(new Set()), HIGHLIGHT_MS)
    }
    const fresh = added.map((l) => ({ key: ++lineKey.current, author: l.actor === me ? '' : view.players[l.actor]?.name ?? '', text: l.text, roll: l.roll }))
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
      else if (command.kind === 'abilities') setAbilitiesFor(command.id)
      else if (command.kind === 'effect') setEffectFor({ ids: command.ids, title: command.title })
      else if (command.kind === 'order') setOrdering({ ids: command.ids, zone: command.zone, ...(command.position ? { position: command.position } : {}) })
      else if (command.kind === 'clearSelection') setSelection(null)
      else if (command.kind === 'askAi') {
        const entry = catalogs[command.owner]?.entries.find((e) => e.ref === command.ref)
        if (entry && ai) ai.addCard(aiCardRef(entry.en, entry.fr))
      }
      else {
        const answer = prompt(command.question, String(command.fallback))
        const n = answer === null ? NaN : Number.parseInt(answer, 10)
        if (Number.isFinite(n) && n > 0) run(command.then(n))
      }
    }
  }, [send, catalogs, ai])

  /** `target` : la carte du menu, pour afficher les touches de ses raccourcis. */
  const toItems = (entries: MenuEntry[], target?: { card: VisibleCard; zone: ZoneRef }): MenuItem[] => {
    const hints = menuHints(entries, bindings, target)
    return entries.map((e, i) => {
      if (e.kind === 'item') return { kind: 'action', label: e.label, onSelect: () => run(e.commands), shortcut: hints[i] }
      if (e.kind === 'stepper') {
        const set = e.set
        return { kind: 'stepper', label: e.label, value: e.value, signed: e.signed, onChange: (d: number) => run([d < 0 ? e.minus : e.plus]),
          onSet: set && ((n: number) => run(set(n))), shortcut: hints[i] }
      }
      return e
    })
  }

  /** Carte d'un menu ouvert, encore visible dans sa zone (pas pour le menu de l'encart force/loyauté). */
  const menuTarget = (m: NonNullable<typeof menu>) => {
    const card = m.card && !m.card.pt ? cards.get(m.card.id) : undefined
    const zone = card ? zoneOf(view, card.id) : null
    return card && zone ? { card, zone } : undefined
  }

  /** Menu d'une carte reconstruit à chaque rendu : les marqueurs affichés (et l'écart d'une valeur tapée) suivent la partie. */
  const liveEntries = (m: { entries: MenuEntry[]; card?: { id: string; zone: ZoneRef; pt?: boolean } }): MenuEntry[] => {
    const { id, zone, pt } = m.card ?? {}
    if (!id || !zone || zone.zone === 'library') return m.entries
    const card = cards.get(id)
    const z = zone.zone
    if (!card || !view.players[zone.player]?.zones[z].some((c) => !c.hidden && c.id === id)) return m.entries
    const fresh = pt ? statMenu(menuCtx, card) : cardMenu(menuCtx, card, zone)
    return fresh.length > 0 ? fresh : m.entries
  }

  const openMenu = (entries: MenuEntry[], at: MenuPoint, library?: string) => {
    if (entries.length > 0) setMenu({ x: at.clientX, y: at.clientY, entries, touch: at.touch, library })
  }

  /**
   * Image du menu ouvert au doigt, recalculée à chaque rendu comme l'aperçu au survol : une carte devenue
   * cachée (retournée, rendue en main) ou une carte du dessus piochée disparaît du menu resté ouvert.
   */
  const menuImage = (m: NonNullable<typeof menu>) => {
    if (!m.touch) return null
    const card = m.library ? libraryTop(view, m.library) ?? undefined : m.card && cards.get(m.card.id)
    return cardPreview(card, catalogs[card?.owner ?? ''], lang)
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

  // Gestionnaire refait à chaque rendu (carte survolée, menus, fenêtres) ; un seul écouteur le lit.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    const shortcut = shortcutFor(e, bindings)
    if (!shortcut) return
    if (shortcut === 'close') {
      setMenu(null)
      if (pile) closePile(false)
      setTokenOpen(false)
      setDiceOpen(false)
      setStartDraw(false)
      setOracle(null)
      setAbilitiesFor(null)
      setEffectFor(null)
      setLogOpen(false)
      setSettingsOpen(false)
      setShortcutsOpen(false)
      setAnimationsOpen(false)
      setOrdering(null)
      setSelection(null)
      return
    }
    // Pas de raccourci de jeu tant qu'une fenêtre est ouverte.
    if (pile || tokenOpen || diceOpen || startDraw || oracle || abilitiesFor || effectFor || menu || ordering || shortcutsOpen || animationsOpen) return
    if (shortcut === 'help') {
      e.preventDefault()
      setSettingsOpen(false)
      return setShortcutsOpen(true)
    }
    // Ni pour un spectateur.
    if (!canAct) return
    if (isCardShortcut(shortcut)) {
      // Carte sous la souris, avec les mêmes entrées que son menu clic droit (rien pour une carte cachée).
      const commandsFor = (id: string) => {
        const card = cards.get(id)
        const zone = card ? zoneOf(view, card.id) : null
        return card && zone ? cardShortcutCommands(cardMenu(menuCtx, card, zone), card, zone, shortcut) : null
      }
      // Sélection de plusieurs cartes (souris dessus ou ailleurs que sur une carte) : tout le groupe, comme son menu.
      const group = live && live.ids.length > 1 && (!hovered || live.ids.includes(hovered)) ? live : null
      let commands = hovered ? commandsFor(hovered) : null
      if (group) {
        const perCard = appliesPerCard(shortcut) ? group.ids.flatMap((id) => commandsFor(id) ?? []) : []
        commands = selectionShortcutCommands(selectionMenu(menuCtx, group), shortcut) ?? (perCard.length > 0 ? perCard : commands)
      }
      if (!commands) return
      e.preventDefault()
      // La carte quitte la souris : un second appui ne doit pas la déplacer encore depuis sa nouvelle zone.
      if (movesCard(shortcut)) setHovered(null)
      return run(commands)
    }
    e.preventDefault()
    if (shortcut === 'undo') return source.undo()
    const actions = {
      draw: { type: 'draw', count: 1 },
      untapAll: { type: 'untapAll' },
      nextTurn: { type: 'endTurn' },
      shuffle: { type: 'shuffle' },
      mulligan: { type: 'mulligan' },
    } satisfies Record<Exclude<typeof shortcut, 'undo'>, ClientAction>
    send(actions[shortcut])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handlers: CardHandlers = {
    onDoubleClick: (id, zone) => {
      if (!canAct) return
      if (id.startsWith('top:')) return send({ type: 'draw', count: 1 })
      if (zone.zone === 'battlefield') send({ type: 'tap', id })
      else if (zone.zone === 'hand' && zone.player === me) send({ type: 'move', id, to: { player: me, zone: 'battlefield' }, x: 50, y: 50 })
    },
    onContextMenu: (id, zone, at) => {
      // Carte d'un groupe sélectionné : menu du groupe.
      if (live && live.ids.length > 1 && live.ids.includes(id) && sameZone(live.zone, zone)) {
        const entries = selectionMenu(menuCtx, live)
        if (entries.length > 0) return setMenu({ x: at.clientX, y: at.clientY, entries, touch: at.touch })
      }
      const card = cards.get(id)
      const entries = card ? cardMenu(menuCtx, card, zone) : []
      // Au doigt, pas d'aperçu au survol : l'image de la carte est dans le menu, même sans entrée.
      const preview = at.touch ? cardPreview(card, catalogs[card?.owner ?? ''], lang) : null
      if (entries.length > 0 || preview) setMenu({ x: at.clientX, y: at.clientY, entries, card: { id, zone }, touch: at.touch })
    },
    onHover: (id) => setHovered(id),
    onPtEdit: canAct ? (id, zone, at) => {
      const card = cards.get(id)
      const entries = card ? statMenu(menuCtx, card) : []
      if (entries.length > 0) setMenu({ x: at.clientX, y: at.clientY, entries, card: { id, zone, pt: true } })
    } : undefined,
  }

  function onDragStart(e: DragStartEvent) {
    // Carte glissée : l'identifiant du glisser peut différer (vignette Cim., fenêtre d'une pile).
    const id = String(e.active.data.current?.card ?? e.active.id)
    // offsetHeight ignore la rotation d'une carte engagée, contrairement au rectangle mesuré par dnd-kit.
    const node = document.querySelector<HTMLElement>(`[data-drag-key="${CSS.escape(String(e.active.id))}"]`)
    const group = live && live.ids.length > 1 && live.ids.includes(id) ? live.ids : undefined
    setDragging({ id, from: e.active.data.current?.from as ZoneRef, height: node?.offsetHeight || 134, group })
  }

  /** Groupe sélectionné lâché : déplacé ensemble sur mon champ de bataille, ou rangé dans une de mes zones. */
  function dropGroup(group: string[], held: string, from: ZoneRef, to: ZoneRef, placement: { x?: number; y?: number; position?: Position }) {
    if (to.player !== me || (sameZone(from, to) && to.zone !== 'battlefield')) return
    if (to.zone === 'battlefield') {
      const at = { x: placement.x ?? 50, y: placement.y ?? 50 }
      const heldCard = cards.get(held)
      const places = from.zone === 'battlefield' && heldCard
        ? shiftedPlaces(group.map((id) => cards.get(id) ?? heldCard), at.x - heldCard.x, at.y - heldCard.y)
        : rowPlaces(group.length, at, group.indexOf(held))
      return send({ type: 'moveMany', ids: group, zone: 'battlefield', places })
    }
    if (to.zone === 'library') return setOrdering({ ids: group, zone: 'library', position: placement.position === 'bottom' ? 'bottom' : 'top' })
    if (to.zone === 'graveyard') return setOrdering({ ids: group, zone: 'graveyard' })
    send({ type: 'moveMany', ids: group, zone: to.zone })
  }

  function onDragEnd(e: DragEndEvent) {
    const height = dragging?.height ?? 0
    const group = dragging?.group
    setDragging(null)
    const to = e.over?.data.current as ZoneRef | undefined
    const from = e.active.data.current?.from as ZoneRef | undefined
    const id = String(e.active.data.current?.card ?? e.active.id)
    // Lâchée dans la fenêtre d'une pile (réordonnée par la fenêtre elle-même) : pas une zone.
    if (!to?.zone || !from || !me) return
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
    if (group) return dropGroup(group, id, from, to, placement)
    if (id.startsWith('top:')) send({ type: 'moveTop', to, ...placement })
    else send({ type: 'move', id, to, ...placement })
  }

  const pileCards: VisibleCard[] = !pile ? [] : pile.zone === 'library'
    ? view.players[pile.player].zones.library.visible.map((v) => v.card)
    : view.players[pile.player].zones[pile.zone].filter((c): c is VisibleCard => !c.hidden).reverse()

  const mine = me ? view.players[me] : null
  // Fermée d'elle-même si la carte n'est plus visible (quittée du champ de bataille, retournée face cachée…).
  const abilitiesCard = abilitiesFor && Object.values(view.players).some((p) => p.zones.battlefield.some((c) => !c.hidden && c.id === abilitiesFor))
    ? cards.get(abilitiesFor)
    : undefined
  // Cartes visées encore en jeu et visibles ; fenêtre fermée d'elle-même s'il n'en reste aucune.
  const effectIds = effectFor
    ? effectFor.ids.filter((id) => Object.values(view.players).some((p) => p.zones.battlefield.some((c) => !c.hidden && c.id === id)))
    : []
  const oracleEntry = oracle ? catalogs[oracle.owner]?.entries.find((e) => e.ref === oracle.ref) : undefined
  const zoneProps = { view, catalogs, lang, handlers, interactive: canAct, highlighted, settings, arriving }
  const zoneSelection: ZoneSelection | undefined = canAct ? {
    ids: new Set(live?.ids ?? []),
    lifted: new Set(dragging?.group ?? []),
    onSelect: (zone, ids, additive) => setSelection(selectIds(live, zone, ids, additive)),
    onToggle: (zone, id) => setSelection(toggleId(live, zone, id)),
    onClear: () => setSelection(null),
  } : undefined
  const orderCards = ordering ? ordering.ids.flatMap((id) => cards.get(id) ?? []) : []
  const finishOrdering = (extra: { ids?: string[]; random?: true }) => {
    if (!ordering) return
    const { ids = orderCards.map((c) => c.id), random } = extra
    if (ids.length === 0) return setOrdering(null)
    send({ type: 'moveMany', ids, zone: ordering.zone, ...(ordering.position ? { position: ordering.position } : {}), ...(random ? { random } : {}) })
    setOrdering(null)
    setSelection(null)
  }
  // Adversaires dans l'ordre des places ; pour un spectateur, tous les joueurs.
  const opponents = Object.keys(view.players).filter((p) => p !== me)
  // Un plateau sorti dans une fenêtre quitte la table, qui récupère la place.
  const shownOpponents = opponents.filter((p) => !windows.detached.includes(p))
  const detachOf = (p: string) => (windows.canDetach ? () => windows.open(p) : undefined)
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

  /**
   * Ligne portrait (vie en gros) : `column` pour une colonne, `header` pour l'en-tête d'un adversaire ;
   * `up` : bulle ouverte vers le haut (ma colonne, en bas de l'écran) ; `onTitleClick` : agrandir (bandeau).
   */
  const portraitFor = (player: string, size: 'column' | 'header' = 'column', up = false, onTitleClick?: () => void, onDetach?: () => void) => (
    <PlayerPortrait view={view} player={player} catalogs={catalogs} lang={lang} host={source.online?.host} online={source.online?.players}
      canAct={canAct} send={send} size={size} up={up} onTitleClick={onTitleClick} onDetach={onDetach}
      fx={{ effects: settings.cardEffects, pops: playerFx.pops, cracking: playerFx.cracking }} />
  )
  /** Réserve de mana d'un joueur, posée sur son champ de bataille : modifiable pour la mienne, lecture seule sinon. */
  const manaOf = (player: string) => {
    const p = view.players[player]
    return p && <ManaPool pool={p.mana} keep={p.keepMana} editable={canAct && player === me} send={send} />
  }
  const toggleLang = () => {
    const next = lang === 'fr' ? 'en' : 'fr'
    setLang(next)
    saveLang(next)
  }
  const libraryMenuOf = (p: string) => (at: MenuPoint) => openMenu(libraryMenu(menuCtx, p), at, p)
  const pileOf = (p: string) => (zone: 'graveyard' | 'exile', title: string) => setPile({ title, player: p, zone, mode: 'browse' })

  return (
    // Le glisser couvre toute la table, fenêtre des piles comprise (une carte s'en glisse vers le champ de bataille).
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
    <div className="relative h-full flex flex-col">
      {boardWindow ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-dc-border bg-dc-surface" data-testid="board-window-bar">
          <span className="font-fantasy text-dc-gold text-sm">Plateau de {view.players[boardWindow.player]?.name}</span>
          <span className="text-dc-gold font-fantasy text-sm ml-2" data-testid="turn">Tour {view.turn}</span>
          <span className="text-xs text-dc-muted" data-testid="active-player">Joueur actif : <span className="text-dc-text">{view.players[view.activePlayer]?.name}</span></span>
          <div className="flex items-center gap-2 ml-auto">
            <button className={barButton} onClick={toggleLang} aria-label="Langue des cartes">
              <span className={lang === 'fr' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>FR</span>/
              <span className={lang === 'en' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>EN</span>
            </button>
            <button className={barButton} onClick={boardWindow.onReturn} data-testid="board-window-return">
              <Undo2 className="w-3.5 h-3.5" /> Ramener sur la table
            </button>
          </div>
        </div>
      ) : (
      <TopBar
        back={source.local ? { href: `/decks/${source.local.deckId}`, label: source.local.deckName } : { href: '/salon', label: 'Salon' }}
        turn={view.turn}
        activeName={source.mode === 'online' ? view.players[view.activePlayer]?.name : undefined}
        timer={source.online?.clock && <GameTimer clock={source.online.clock} />}
        lang={lang}
        canAct={canAct}
        canUndo={canAct && source.canUndo}
        canEndTurn={canAct && (source.mode === 'local' || view.activePlayer === me)}
        onNextTurn={() => send({ type: 'endTurn' })}
        onDraw={source.mode === 'online' && me ? () => send({ type: 'draw', count: 1 }) : undefined}
        onLang={toggleLang}
        onUndo={source.undo}
        onToken={() => setTokenOpen(true)}
        onDice={() => setDiceOpen(true)}
        onLog={() => setLogOpen((open) => !open)}
        onSettings={() => setSettingsOpen((open) => !open)}
        onNewGame={source.local ? () => confirm('Commencer une nouvelle partie ?') && source.local?.newGame() : undefined}
        extra={source.online && me && (
          <>
            {source.online.visio && !visio.inCall && (
              <button className={barButton} onClick={() => void visio.join()} disabled={visio.starting} data-testid="visio-join"
                title={visio.presentPlayers.length > 0 ? `En visio : ${visio.presentPlayers.map((p) => view.players[p]?.name ?? '?').join(', ')}` : 'Visio avec les autres joueurs'}>
                <Video className="w-3.5 h-3.5" /> {visio.starting ? 'Visio…' : 'Visio'}
                {visio.presentPlayers.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-dc-gold/20 px-1.5 text-dc-gold" data-testid="visio-count">{visio.presentPlayers.length}</span>
                )}
              </button>
            )}
            {!finished && (<>
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
            </>)}
          </>
        )}
      />
      )}

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

      {windows.blocked && (
        <div className="px-3 py-1.5 text-sm bg-dc-gold/10 border-b border-dc-gold/30 text-dc-text flex items-center gap-2" data-testid="board-window-blocked">
          <span>Le navigateur a bloqué la fenêtre.</span>
          <a className="text-dc-gold underline" href={windows.url(windows.blocked)} target={boardWindowName(windows.blocked)} onClick={windows.dismissBlocked}>
            Ouvrir le plateau de {view.players[windows.blocked]?.name}
          </a>
          <button className="ml-auto text-dc-muted hover:text-dc-text" onClick={windows.dismissBlocked} aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
      )}
      {windows.detached.length > 0 && (
        <div className="px-3 py-1 text-xs bg-dc-surface/60 border-b border-dc-border text-dc-muted flex flex-wrap items-center gap-3" data-testid="detached-bar">
          {windows.detached.map((p) => (
            <span key={p} className="flex items-center gap-1.5" data-detached={p}>
              <ExternalLink className="w-3.5 h-3.5" /> Plateau de <span className="text-dc-text">{view.players[p]?.name}</span> dans une fenêtre à part
              <button className="px-2 py-0.5 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50" onClick={() => windows.bring(p)}>Ramener</button>
            </span>
          ))}
        </div>
      )}

      {!boardWindow && mine && !mine.kept && canAct && (
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
        {visio.inCall && <VisioPanel visio={visio} names={Object.fromEntries(Object.entries(view.players).map(([id, p]) => [id, p.name]))} />}
          {boardWindow ? (
            <div className="flex-1 min-h-0 p-2">
              <OpponentBoard
                {...zoneProps} player={boardWindow.player} me={me}
                portrait={portraitFor(boardWindow.player)}
                mana={manaOf(boardWindow.player)}
                onLibraryMenu={libraryMenuOf(boardWindow.player)}
                onPile={pileOf(boardWindow.player)}
              />
            </div>
          ) : shownOpponents.length > 0 && (
            <div className={`${me ? `${shownOpponents.length === 1 ? 'h-[40%]' : 'h-[38%]'} shrink-0` : 'flex-1'} min-h-0 px-2 pt-2`}>
              <OpponentsArea
                view={view}
                players={shownOpponents}
                renderStrip={(p, focus) => (
                  <OpponentStrip
                    view={view} player={p} catalogs={catalogs} lang={lang} handlers={handlers} highlighted={highlighted}
                    stacked={shownOpponents.length >= 3}
                    mana={manaOf(p)}
                    effects={settings.cardEffects}
                    arriving={arriving}
                    abilityStyle={settings.abilityStyle}
                    header={(
                      <PlayerHeader {...zoneProps} player={p} me={me} handZone portrait={portraitFor(p, 'header', false, focus, detachOf(p))}
                        onLibraryMenu={libraryMenuOf(p)} onPile={pileOf(p)} />
                    )}
                  />
                )}
                renderBoard={(p) => (
                  <OpponentBoard
                    {...zoneProps} player={p} me={me}
                    portrait={portraitFor(p, 'column', false, undefined, detachOf(p))}
                    mana={manaOf(p)}
                    onLibraryMenu={libraryMenuOf(p)}
                    onPile={pileOf(p)}
                  />
                )}
              />
            </div>
          )}
          {me && !boardWindow && (
            <MyBoard
              {...zoneProps}
              selection={zoneSelection}
              player={me}
              me={me}
              portrait={portraitFor(me, 'column', true)}
              mana={manaOf(me)}
              onLibraryMenu={(at) => openMenu(libraryMenu(menuCtx, me), at, me)}
              onHandMenu={(at) => openMenu(handMenu(menuCtx), at)}
              onPile={(zone, title) => setPile({ title, player: me, zone, mode: 'browse' })}
            />
          )}
          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div className="relative pointer-events-none" style={{ height: dragging.height, width: dragging.height * CARD_RATIO }} data-testid="drag-overlay">
                {dragging.group && (
                  <span className="absolute -top-2 -right-2 z-10 min-w-6 h-6 px-1.5 flex items-center justify-center rounded-full bg-sky-500 text-white text-xs font-semibold shadow-card" data-testid="drag-count">
                    {dragging.group.length}
                  </span>
                )}
                {(() => {
                  // Carte du dessus : face visible si je la connais, dos sinon.
                  const shown = dragging.id.startsWith('top:') ? libraryTop(view, dragging.from.player) : cards.get(dragging.id)
                  return shown
                    ? <GameCard card={shown} catalog={catalogs[shown.owner]} lang={lang} className="h-full" />
                    : <CardBack className="h-full" />
                })()}
              </div>
            )}
          </DragOverlay>
        <ActivityFeed lines={boardWindow ? [] : lines} error={source.error} />
        <DungeonHost view={view} canAct={canAct} animate={settings.cardEffects.dungeon} offers={!boardWindow} send={send} />
        {!boardWindow && <DiceTray rolls={playerFx.rolls} />}
        {logOpen && <LogPanel view={view} onClose={() => setLogOpen(false)} />}
      </div>
      {!dragging && <PreviewPane card={hovered ? cards.get(hovered) ?? null : null} catalog={catalogs[cards.get(hovered ?? '')?.owner ?? '']} lang={lang} />}

      {menu && <CardMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menu.items ?? toItems(liveEntries(menu), menuTarget(menu))} preview={menuImage(menu)} />}
      {pile && (
        <PileModal
          key={`${pile.player}-${pile.zone}-${pile.mode}`}
          title={pile.title}
          player={pile.player}
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
      {ordering && orderCards.length > 0 && (
        <OrderModal
          title={ordering.zone === 'graveyard' ? 'Cimetière : ordre des cartes'
            : `${ordering.position === 'bottom' ? 'Dessous' : 'Dessus'} de la bibliothèque : ordre des cartes`}
          cards={orderCards}
          catalogs={catalogs}
          lang={lang}
          onConfirm={(ids) => finishOrdering({ ids })}
          onRandom={() => finishOrdering({ random: true })}
          onClose={() => setOrdering(null)}
        />
      )}
      {tokenOpen && (
        <TokenModal deckTokens={source.deckTokens} onCreate={(token) => send({ type: 'createToken', token, x: 50, y: 50 })} onClose={() => setTokenOpen(false)} />
      )}
      {startDraw && <StartDraw view={view} onClose={() => setStartDraw(false)} />}
      {abilitiesCard && (
        <AbilitiesModal
          name={abilitiesCard.faceDown ? 'carte face cachée' : cardInfo(catalogs[abilitiesCard.owner], abilitiesCard, lang).name}
          printed={printedKeywordsOf(catalogs[abilitiesCard.owner], abilitiesCard)}
          gained={abilitiesCard.gained ?? []}
          lost={abilitiesCard.lost ?? []}
          onValidate={(gained, lost, untilEndOfTurn) => send({ type: 'abilities', id: abilitiesCard.id, gained, lost, ...(untilEndOfTurn ? { untilEndOfTurn } : {}) })}
          onClose={() => setAbilitiesFor(null)}
        />
      )}
      {effectFor && effectIds.length > 0 && (
        <AbilitiesModal
          effect
          name={`${effectFor.title} (${effectIds.length})`}
          printed={[]}
          gained={[]}
          lost={[]}
          onValidate={(gained, _lost, untilEndOfTurn, pt) => send({ type: 'effect', ids: effectIds, power: pt.power, toughness: pt.toughness, gained, ...(untilEndOfTurn ? { untilEndOfTurn } : {}) })}
          onClose={() => setEffectFor(null)}
        />
      )}
      {diceOpen && (
        <DiceModal count={diceCount} onCount={setDiceCount} onRoll={(sides, count) => send({ type: 'roll', sides, count })} onClose={() => setDiceOpen(false)} />
      )}
      {oracleEntry && (
        <OracleModal
          en={oracleEntry.en}
          fr={oracleEntry.fr}
          onClose={() => setOracle(null)}
          onAskAi={ai ? () => { ai.open(aiCardRef(oracleEntry.en, oracleEntry.fr)); setOracle(null) } : undefined}
        />
      )}
      {settingsOpen && <TableSettingsPanel settings={settings} onChange={changeSettings} onClose={() => setSettingsOpen(false)}
        onShortcuts={() => { setSettingsOpen(false); setShortcutsOpen(true) }}
        onAnimations={() => { setSettingsOpen(false); setAnimationsOpen(true) }} />}
      <HolderFlights flights={playerFx.flights} />
      {playerFx.victory && !boardWindow && <VictoryScreen view={view} winner={playerFx.victory} catalogs={catalogs} lang={lang} onClose={playerFx.dismissVictory} />}
      {shortcutsOpen && <ShortcutsModal bindings={bindings} onChange={changeBindings} onClose={() => setShortcutsOpen(false)} />}
      {animationsOpen && <AnimationsModal effects={settings.cardEffects} onChange={(cardEffects) => changeSettings({ ...settings, cardEffects })}
        onClose={() => setAnimationsOpen(false)} />}
      {/* Écran tactile en portrait : la table ne tient qu'en paysage ; la partie continue derrière. Message neutre : un téléphone tenu droit (hors cible) le voit aussi. */}
      <div className="hidden tablet-portrait:flex fixed inset-0 z-[80] items-center justify-center p-8 bg-dc-bg text-center font-fantasy text-xl text-dc-gold" data-testid="rotate">
        Tourne l’écran en paysage pour jouer.
      </div>
    </div>
    </DndContext>
  )
}
