// Dés et pile ou face : tirage déterministe pour une graine (posée par le serveur en ligne).
import { createRng } from './random'
import type { Seed } from './types'

/** Dés proposés ; 2 faces = pile ou face. */
export const DICE_SIDES = [2, 4, 6, 8, 10, 12, 20] as const
/** Plus grand nombre de dés lancés d'un coup. */
export const MAX_DICE = 10

export const isDiceRoll = (sides: number, count: number) =>
  (DICE_SIDES as readonly number[]).includes(sides) && Number.isInteger(count) && count >= 1 && count <= MAX_DICE

/** Résultat de chaque dé, de 1 au nombre de faces (pièce : 1 = pile, 2 = face). */
export function rollDice(sides: number, count: number, seed: Seed): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => 1 + Math.floor(rng() * sides))
}

/** Ligne du journal : « Lance un d20 : 17 », « Lance 3d6 : 4, 2, 6 (total 12) », « Pile ou face : Pile ». */
export function rollText(sides: number, results: number[]): string {
  if (sides === 2) {
    const faces = results.map((n) => (n === 1 ? 'Pile' : 'Face')).join(', ')
    return results.length === 1 ? `Pile ou face : ${faces}` : `Lance ${results.length} pièces : ${faces}`
  }
  if (results.length === 1) return `Lance un d${sides} : ${results[0]}`
  const total = results.reduce((a, b) => a + b, 0)
  return `Lance ${results.length}d${sides} : ${results.join(', ')} (total ${total})`
}

/** Dé et résultats d'une ligne de `rollText` (lancer vu au journal, même d'un serveur de jeu plus ancien) ; rien pour une autre ligne. */
export function parseRoll(text: string): { sides: number; results: number[] } | null {
  const coin = /^(?:Pile ou face|Lance \d+ pièces) : (.+)$/.exec(text)
  if (coin) {
    const results = coin[1].split(', ').map((f) => (f === 'Pile' ? 1 : f === 'Face' ? 2 : 0))
    return results.every((n) => n > 0) ? { sides: 2, results } : null
  }
  const dice = /^Lance (?:un |\d+)d(\d+) : ([\d, ]+?)(?: \(total \d+\))?$/.exec(text)
  if (!dice) return null
  const sides = Number(dice[1])
  const results = dice[2].split(', ').map(Number)
  if (!(DICE_SIDES as readonly number[]).includes(sides) || results.some((n) => !Number.isInteger(n) || n < 1 || n > sides)) return null
  return { sides, results }
}
