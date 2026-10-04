import { applyAction } from './apply'
import { canApply } from './rules'
import { createInitialState } from './setup'
import { SNAPSHOT_EVERY, type GameAction, type GameSetup, type GameState } from './types'

export function replay(setup: GameSetup, actions: readonly GameAction[]): GameState {
  return actions.reduce(applyAction, createInitialState(setup))
}

/** Partie = liste d'actions acceptées. Un état est mis de côté toutes les 20 actions pour annuler vite. */
export class GameHistory {
  private list: GameAction[] = []
  private snapshots = new Map<number, GameState>()
  private current: GameState

  constructor(setup: GameSetup, actions: readonly GameAction[] = []) {
    this.current = createInitialState(setup)
    this.snapshots.set(0, this.current)
    for (const action of actions) this.push(action)
  }

  get state(): GameState {
    return this.current
  }

  get actions(): readonly GameAction[] {
    return this.list
  }

  /** null si l'action est jouée, sinon le message de refus (et rien ne change). */
  push(action: GameAction): string | null {
    const error = canApply(this.current, action)
    if (error !== null) return error
    this.current = applyAction(this.current, action)
    this.list.push(action)
    if (this.list.length % SNAPSHOT_EVERY === 0) this.snapshots.set(this.list.length, this.current)
    return null
  }

  /** Vrai si la dernière action est de `actor` (personne n'a joué depuis) et n'est pas le début de partie. */
  canUndo(actor: string): boolean {
    const last = this.list.at(-1)
    return !!last && last.type !== 'start' && last.actor === actor
  }

  undo(actor: string): boolean {
    if (!this.canUndo(actor)) return false
    this.list.pop()
    const length = this.list.length
    for (const key of this.snapshots.keys()) if (key > length) this.snapshots.delete(key)
    const base = Math.max(...this.snapshots.keys())
    this.current = this.list.slice(base).reduce(applyAction, this.snapshots.get(base)!)
    return true
  }
}
