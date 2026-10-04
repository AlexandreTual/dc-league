'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { bottomCount } from '@/lib/game/apply'
import { GameHistory } from '@/lib/game/replay'
import { clearGame, loadGame, saveGame } from '@/lib/game/storage'
import type { Catalog, GameAction, ZoneId } from '@/lib/game/types'
import GameCard, { CardBack, type Lang } from './GameCard'
import TopBar from './TopBar'
import { Battlefield, Hand, ZonePile, type CardHandlers } from './zones'

const LANG_KEY = 'dc-card-lang'

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

type Phase = { step: 'loading' } | { step: 'resume'; actions: GameAction[] } | { step: 'playing' }

export default function Playtest({ catalog, excluded, deckName }: { catalog: Catalog; excluded: string[]; deckName: string }) {
  const history = useRef<GameHistory | null>(null)
  const [, setVersion] = useState(0)
  const [phase, setPhase] = useState<Phase>({ step: 'loading' })
  const [lang, setLang] = useState<Lang>('fr')
  const [kept, setKept] = useState(false)
  const [showExcluded, setShowExcluded] = useState(excluded.length > 0)
  const [dragging, setDragging] = useState<{ id: string; from: ZoneId } | null>(null)
  const shiftDown = useRef(false)

  const rerender = () => setVersion((v) => v + 1)

  const startGame = useCallback((actions: GameAction[] | null) => {
    if (!actions) clearGame(catalog.deckId)
    history.current = new GameHistory(catalog, actions ?? [{ type: 'start', seed: randomSeed() }])
    saveGame(catalog, history.current.actions)
    setKept(!!actions && actions.some((a) => a.type !== 'start' && a.type !== 'mulligan'))
    setPhase({ step: 'playing' })
  }, [catalog])

  useEffect(() => {
    setLang(readLang())
    const saved = loadGame(catalog)
    if (saved && saved.length > 0) setPhase({ step: 'resume', actions: saved })
    else startGame(null)
  }, [catalog, startGame])

  useEffect(() => {
    const track = (e: KeyboardEvent) => { shiftDown.current = e.shiftKey }
    window.addEventListener('keydown', track)
    window.addEventListener('keyup', track)
    return () => {
      window.removeEventListener('keydown', track)
      window.removeEventListener('keyup', track)
    }
  }, [])

  const dispatch = useCallback((action: GameAction) => {
    const h = history.current
    if (!h) return
    h.push(action)
    if (action.type !== 'mulligan') setKept(true)
    saveGame(catalog, h.actions)
    rerender()
  }, [catalog])

  const undo = useCallback(() => {
    const h = history.current
    if (!h?.canUndo()) return
    h.undo()
    saveGame(catalog, h.actions)
    rerender()
  }, [catalog])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  if (phase.step === 'loading' || !history.current && phase.step === 'playing') return null

  if (phase.step === 'resume') {
    const turn = new GameHistory(catalog, phase.actions).state.turn
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-6 space-y-4 text-center">
          <p className="font-fantasy text-dc-gold text-lg">{deckName}</p>
          <p className="text-dc-muted text-sm">Une partie de test est en cours.</p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold" onClick={() => startGame(phase.actions)}>
              Reprendre la partie (tour {turn})
            </button>
            <button className="px-4 py-2 rounded-xl border border-dc-border text-dc-text" onClick={() => startGame(null)}>
              Nouvelle partie
            </button>
          </div>
        </div>
      </div>
    )
  }

  const h = history.current!
  const state = h.state
  const onlyMulligans = h.actions.every((a) => a.type === 'start' || a.type === 'mulligan')
  const toBottom = bottomCount(state)

  const handlers: CardHandlers = {
    onDoubleClick: (id, zone) => {
      if (zone === 'battlefield') dispatch({ type: 'tap', id })
      else if (zone === 'library') dispatch({ type: 'draw', count: 1 })
      else if (zone === 'hand') dispatch({ type: 'move', id, to: 'battlefield', x: 50, y: 50 })
    },
    onContextMenu: () => {},
    onHover: () => {},
  }

  function onDragStart(e: DragStartEvent) {
    setDragging({ id: String(e.active.id), from: e.active.data.current?.from as ZoneId })
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const to = e.over?.id as ZoneId | undefined
    const id = String(e.active.id)
    if (!to) return
    if (to === 'battlefield') {
      const rect = e.active.rect.current.translated
      const zone = e.over!.rect
      if (!rect) return
      const x = ((rect.left + rect.width / 2 - zone.left) / zone.width) * 100
      const y = ((rect.top + rect.height / 2 - zone.top) / zone.height) * 100
      dispatch({ type: 'move', id, to, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
    } else if (to === 'library') {
      dispatch({ type: 'move', id, to, position: shiftDown.current ? 'bottom' : 'top' })
    } else if (to !== e.active.data.current?.from) {
      dispatch({ type: 'move', id, to })
    }
  }

  const zoneProps = { state, catalog, lang, handlers }

  return (
    <div className="h-full flex flex-col">
      <TopBar
        deckId={catalog.deckId}
        deckName={deckName}
        turn={state.turn}
        life={state.life}
        lang={lang}
        canUndo={h.canUndo()}
        onNextTurn={() => dispatch({ type: 'nextTurn' })}
        onLife={(delta) => dispatch({ type: 'life', delta })}
        onLang={() => {
          const next = lang === 'fr' ? 'en' : 'fr'
          setLang(next)
          try { localStorage.setItem(LANG_KEY, next) } catch { /* préférence non mémorisée */ }
        }}
        onUndo={undo}
        onNewGame={() => confirm('Commencer une nouvelle partie ?') && startGame(null)}
      />

      {showExcluded && (
        <div className="px-3 py-1.5 text-xs bg-dc-red/20 text-dc-red-light flex justify-between">
          <span>Cartes introuvables exclues du test : {excluded.join(', ')}</span>
          <button onClick={() => setShowExcluded(false)}>Fermer</button>
        </div>
      )}

      {!kept && onlyMulligans && (
        <div className="px-3 py-2 text-sm bg-dc-gold/10 border-b border-dc-gold/30 text-dc-gold flex items-center gap-3" data-testid="mulligan-banner">
          <span>
            {state.stats.mulligans === 0 ? 'Main de départ' : `Mulligan n°${state.stats.mulligans}`}
            {toBottom > 0 && ` : mets ${toBottom} carte(s) en dessous de ta bibliothèque (Maj + glisser sur la bibliothèque)`}
          </span>
          <button className="px-3 py-1 rounded-lg bg-dc-gold/20 border border-dc-gold/40" onClick={() => setKept(true)}>Garder</button>
          <button className="px-3 py-1 rounded-lg border border-dc-gold/40" onClick={() => dispatch({ type: 'mulligan', seed: randomSeed() })}>Mulligan</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="flex-1 min-h-0 flex flex-col gap-2 p-2">
          <div className="flex-1 min-h-0 flex gap-2">
            <Battlefield {...zoneProps} />
            <div className="w-36 shrink-0 grid grid-rows-4 gap-2 min-h-0">
              <ZonePile zone="command" {...zoneProps} />
              <ZonePile zone="library" {...zoneProps} />
              <ZonePile zone="graveyard" {...zoneProps} />
              <ZonePile zone="exile" {...zoneProps} />
            </div>
          </div>
          <Hand {...zoneProps} />
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="w-24 pointer-events-none">
              {dragging.from === 'library' ? <CardBack /> : <GameCard id={dragging.id} state={state} catalog={catalog} lang={lang} />}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
