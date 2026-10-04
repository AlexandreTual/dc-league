import { applyAction } from './apply'
import { createInitialState } from './setup'
import { SNAPSHOT_EVERY, type Catalog, type GameAction, type GameState } from './types'

export function replay(catalog: Catalog, actions: readonly GameAction[]): GameState {
  return actions.reduce((state, action) => applyAction(state, action, catalog), createInitialState(catalog))
}

/** Partie = liste d'actions. Un état est mis de côté toutes les 20 actions pour annuler vite. */
export class GameHistory {
  private list: GameAction[] = []
  private snapshots = new Map<number, GameState>()
  private current: GameState

  constructor(private readonly catalog: Catalog, actions: readonly GameAction[] = []) {
    this.current = createInitialState(catalog)
    this.snapshots.set(0, this.current)
    for (const action of actions) this.push(action)
  }

  get state(): GameState {
    return this.current
  }

  get actions(): readonly GameAction[] {
    return this.list
  }

  push(action: GameAction): GameState {
    this.current = applyAction(this.current, action, this.catalog)
    this.list.push(action)
    if (this.list.length % SNAPSHOT_EVERY === 0) this.snapshots.set(this.list.length, this.current)
    return this.current
  }

  /** Le début de partie (première action) ne s'annule pas. */
  canUndo(): boolean {
    return this.list.length > 1
  }

  undo(): GameState {
    if (!this.canUndo()) return this.current
    this.list.pop()
    const length = this.list.length
    for (const key of this.snapshots.keys()) if (key > length) this.snapshots.delete(key)
    const base = Math.max(...this.snapshots.keys())
    let state = this.snapshots.get(base)!
    for (const action of this.list.slice(base)) state = applyAction(state, action, this.catalog)
    this.current = state
    return state
  }
}
