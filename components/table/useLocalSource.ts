'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { randomSeed, startAction } from '@/lib/game/random'
import { GameHistory } from '@/lib/game/replay'
import type { ClientAction } from '@/lib/game/room'
import { clearGame, loadGame, saveGame } from '@/lib/game/storage'
import { viewFor } from '@/lib/game/view'
import type { Catalog, GameAction, GameSetup } from '@/lib/game/types'
import { ERROR_VISIBLE_MS, type GameSource } from './source'

/** Le mode test est une partie à un seul joueur. */
export const SOLO = 'solo'

function soloSetup(catalog: Catalog): GameSetup {
  return { format: 'commander', players: [{ id: SOLO, name: 'Moi', catalog }], options: { eliminatedSeeAll: false } }
}

/** Action complète du joueur solo : auteur et graine ajoutés ici (le serveur le fait en ligne). */
function withActorAndSeed(action: ClientAction): GameAction {
  const full = { ...action, actor: SOLO } as GameAction
  if (full.type === 'mulligan' || full.type === 'shuffle' || full.type === 'endLook') return { ...full, seed: randomSeed() } as GameAction
  return full
}

export type LocalPhase =
  | { step: 'loading' }
  | { step: 'resume'; turn: number; resume(): void; restart(): void }
  | { step: 'playing'; source: GameSource }

/** Partie de test dans le navigateur : historique, sauvegarde locale, reprise, « Garder » implicite. */
export function useLocalSource(catalog: Catalog, deckName: string): LocalPhase {
  const history = useRef<GameHistory | null>(null)
  const [, setVersion] = useState(0)
  const [saved, setSaved] = useState<GameAction[] | null | 'none'>(null)
  const [error, setError] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout>>()
  const setup = useMemo(() => soloSetup(catalog), [catalog])
  const rerender = () => setVersion((v) => v + 1)

  const startGame = useCallback((actions: GameAction[] | null) => {
    if (!actions) clearGame(catalog.deckId)
    history.current = new GameHistory(setup, actions ?? [startAction([SOLO])])
    saveGame(catalog, history.current.actions)
    setSaved('none')
  }, [catalog, setup])

  useEffect(() => {
    const actions = loadGame(catalog)
    if (actions && actions.length > 0) setSaved(actions)
    else startGame(null)
  }, [catalog, startGame])

  useEffect(() => () => clearTimeout(errorTimer.current), [])

  const send = useCallback((action: ClientAction) => {
    const h = history.current
    if (!h) return
    // Toute action autre qu'un mulligan garde implicitement la main de départ.
    if (!h.state.players[SOLO].kept && action.type !== 'mulligan' && action.type !== 'keep') h.push({ type: 'keep', actor: SOLO })
    const refused = h.push(withActorAndSeed(action))
    if (refused) {
      setError(refused)
      clearTimeout(errorTimer.current)
      errorTimer.current = setTimeout(() => setError(null), ERROR_VISIBLE_MS)
    }
    saveGame(catalog, h.actions)
    rerender()
  }, [catalog])

  const undo = useCallback(() => {
    const h = history.current
    if (!h?.undo(SOLO)) return
    saveGame(catalog, h.actions)
    rerender()
  }, [catalog])

  if (saved === null) return { step: 'loading' }
  if (saved !== 'none') {
    return {
      step: 'resume',
      turn: new GameHistory(setup, saved).state.turn,
      resume: () => startGame(saved),
      restart: () => startGame(null),
    }
  }
  const h = history.current!
  const canUndo = h.canUndo(SOLO)
  return {
    step: 'playing',
    source: {
      me: SOLO,
      view: viewFor(h.state, SOLO, canUndo),
      catalogs: { [SOLO]: catalog },
      send,
      undo,
      canUndo,
      error,
      mode: 'local',
      local: { deckId: catalog.deckId, deckName, newGame: () => startGame(null) },
    },
  }
}
