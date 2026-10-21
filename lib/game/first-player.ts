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

/**
 * « Qui commence ? » à l'ouverture de la table : en ligne, à plusieurs, au tour 1 tant que ma main n'est pas gardée.
 * Jamais dans le plateau d'un adversaire sorti en fenêtre à part (la table l'a déjà montré).
 * Serveur plus ancien sans `turnOrder` : rien.
 */
export function opensStartDraw(
  view: { turn: number; turnOrder?: readonly string[]; players: Record<string, { kept?: boolean }> },
  me: string | null,
  { online, boardWindow }: { online: boolean; boardWindow: boolean },
): boolean {
  return online && !boardWindow && me !== null && Object.keys(view.players).length > 1
    && view.turn === 1 && view.players[me]?.kept === false && (view.turnOrder?.length ?? 0) > 0
}
