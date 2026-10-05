// Badges de la pastille d'un joueur : seulement les compteurs non nuls, en alerte près des seuils.
import { COMMANDER_DAMAGE_LETHAL, POISON_LETHAL, type PlayerView } from './types'

export type Badge = { key: string; label: string; level: 'normal' | 'warn' | 'lethal' }

export const POISON_WARN = 8
export const COMMANDER_DAMAGE_WARN = 18

const level = (value: number, warn: number, lethal: number): Badge['level'] =>
  value >= lethal ? 'lethal' : value >= warn ? 'warn' : 'normal'

/** Poison, plus forte blessure de commandant, compteurs libres, monarque, initiative ; rien pour une valeur nulle. */
export function playerBadges(view: PlayerView, player: string, commanderName: (id: string) => string): Badge[] {
  const p = view.players[player]
  const out: Badge[] = []
  if (p.poison > 0) out.push({ key: 'poison', label: `☠ ${p.poison}`, level: level(p.poison, POISON_WARN, POISON_LETHAL) })
  const [worst] = Object.entries(p.commanderDamage).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (worst) {
    const [id, value] = worst
    out.push({ key: 'commander', label: `⚔ ${commanderName(id)} ${value}`, level: level(value, COMMANDER_DAMAGE_WARN, COMMANDER_DAMAGE_LETHAL) })
  }
  for (const [name, value] of Object.entries(p.counters)) {
    if (value > 0) out.push({ key: `counter:${name}`, label: `${name} ${value}`, level: 'normal' })
  }
  if (view.monarch === player) out.push({ key: 'monarch', label: '👑 Monarque', level: 'normal' })
  if (view.initiative === player) out.push({ key: 'initiative', label: 'Initiative', level: 'normal' })
  return out
}
