import { applyAction } from './apply'
import { canApply } from './rules'
import { createInitialState } from './setup'
import { SNAPSHOT_EVERY, type GameAction, type GameSetup, type GameState } from './types'

/** Actions qu'on ne peut jamais annuler. */
const FINAL = new Set<GameAction['type']>(['start', 'roll', 'eliminate'])

export function replay(setup: GameSetup, actions: readonly GameAction[]): GameState {
  return actions.reduce(applyAction, createInitialState(setup))
}

/** Mulligan, mélange, ordre aléatoire : annulés puis rejoués, ils donneraient un nouveau tirage (graine neuve). */
export function isRandomDraw(action: GameAction): boolean {
  if (action.type === 'mulligan' || action.type === 'shuffle') return true
  if (action.type === 'endLook') return action.shuffle
  return action.type === 'moveMany' && !!action.random
}

/** Partie = liste d'actions acceptées. Un état est mis de côté toutes les 20 actions pour annuler vite. */
export class GameHistory {
  private list: GameAction[] = []
  private snapshots = new Map<number, GameState>()
  private current: GameState
  private undoRandom: boolean

  /** `undoRandom` : le mode test (seul à la table) peut annuler un tirage, pas une partie en ligne. */
  constructor(setup: GameSetup, actions: readonly GameAction[] = [], { undoRandom = false }: { undoRandom?: boolean } = {}) {
    this.undoRandom = undoRandom
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

  /**
   * Vrai si la dernière action est de `actor` (personne n'a joué depuis) et n'est ni le début de partie,
   * ni un lancer de dés, ni (hors mode test) un tirage au hasard : sinon on relancerait jusqu'au résultat voulu.
   * Jamais une élimination non plus : un éliminé peut avoir vu toutes les cartes, il ne doit pas revenir en jeu.
   */
  canUndo(actor: string): boolean {
    const last = this.list.at(-1)
    if (!last || FINAL.has(last.type) || last.actor !== actor) return false
    return this.undoRandom || !isRandomDraw(last)
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
