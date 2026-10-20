// Animations des joueurs : ce qui change d'une vue à la suivante (vie, poison, blessures de commandant, élimination,
// monarque et initiative), et bulles d'écart (« −3 ») qui s'additionnent quand les clics sont rapprochés.
import type { PlayerView } from './types'

export type PopKind = 'life' | 'poison' | 'commander'
export type PlayerChange = { kind: PopKind; player: string; delta: number } | { kind: 'eliminated'; player: string }
export type HolderChange = { kind: 'monarch' | 'initiative'; from: string | null; to: string | null }

/** Bulle d'écart affichée au-dessus d'un portrait ; `key` change à chaque nouvel écart pour relancer l'animation. */
export type Pop = { delta: number; key: number; at: number }
/** Bulles par `joueur:type`. */
export type Pops = Record<string, Pop>

/** Durée d'une bulle. */
export const POP_MS = 1400
/** Deux écarts du même joueur et du même type plus rapprochés que ça s'additionnent. */
export const POP_MERGE_MS = 1200

const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0)

/** Changements des joueurs et des titres (monarque, initiative) ; rien au premier affichage (`prev` absent). */
export function playerChanges(prev: PlayerView | null, next: PlayerView): { players: PlayerChange[]; holders: HolderChange[] } {
  if (!prev) return { players: [], holders: [] }
  const players: PlayerChange[] = []
  for (const [id, p] of Object.entries(next.players)) {
    const before = prev.players[id]
    if (!before) continue
    if (p.life !== before.life) players.push({ kind: 'life', player: id, delta: p.life - before.life })
    if (p.poison !== before.poison) players.push({ kind: 'poison', player: id, delta: p.poison - before.poison })
    const commander = sum(p.commanderDamage) - sum(before.commanderDamage)
    if (commander !== 0) players.push({ kind: 'commander', player: id, delta: commander })
    if (p.eliminated && !before.eliminated) players.push({ kind: 'eliminated', player: id })
  }
  const holders: HolderChange[] = []
  if (next.monarch !== prev.monarch) holders.push({ kind: 'monarch', from: prev.monarch, to: next.monarch })
  if (next.initiative !== prev.initiative) holders.push({ kind: 'initiative', from: prev.initiative, to: next.initiative })
  return { players, holders }
}

/** Ajoute les écarts aux bulles : additionnés à une bulle encore récente, sinon nouvelle bulle ; total nul : plus de bulle. */
export function addPops(pops: Pops, changes: PlayerChange[], now: number, key: number): { pops: Pops; key: number } {
  const out = { ...pops }
  for (const change of changes) {
    if (change.kind === 'eliminated') continue
    const id = `${change.player}:${change.kind}`
    const current = out[id]
    const delta = (current && now - current.at < POP_MERGE_MS ? current.delta : 0) + change.delta
    if (delta === 0) delete out[id]
    else out[id] = { delta, key: ++key, at: now }
  }
  return { pops: out, key }
}

/** Retire les bulles finies ; le même objet si aucune ne l'est. */
export function expirePops(pops: Pops, now: number): Pops {
  const kept = Object.entries(pops).filter(([, p]) => now - p.at < POP_MS)
  return kept.length === Object.keys(pops).length ? pops : Object.fromEntries(kept)
}
