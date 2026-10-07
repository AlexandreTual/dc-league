// Lancement de partie : défilement des joueurs jusqu'au premier joueur, déjà tiré par le serveur.

/** Tours complets avant l'arrêt, et durées d'affichage d'un nom (du plus rapide au plus lent). */
const ROUNDS = 3
const FAST_MS = 70
const SLOW_MS = 420

/**
 * Noms affichés tour à tour : dans l'ordre de `players`, en ralentissant, jusqu'à s'arrêter sur `first`.
 * `delay` : durée d'affichage du nom (la dernière étape reste affichée).
 */
export function drawSequence(players: readonly string[], first: string, rounds = ROUNDS): { id: string; delay: number }[] {
  const n = players.length
  if (n === 0) return []
  const count = rounds * n + 1
  const offset = (((players.indexOf(first) - (count - 1)) % n) + n) % n
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 1 : i / (count - 1)
    return { id: players[(offset + i) % n], delay: Math.round(FAST_MS + (SLOW_MS - FAST_MS) * t * t) }
  })
}
