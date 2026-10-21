// Ordre des cartes dans la fenêtre « Regarder les X du dessus » (regard) : la première est le dessus.

/** Décale une carte d'un cran (-1 vers le dessus, +1 vers le dessous), sans sortir de la liste. */
export function shiftCard(order: string[], id: string, delta: -1 | 1): string[] {
  const from = order.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= order.length) return order
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** Glisser-déposer : la carte glissée prend la place de la carte visée. */
export function placeAt(order: string[], id: string, target: string): string[] {
  const from = order.indexOf(id)
  const to = order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return order
  const next = order.filter((x) => x !== id)
  next.splice(to, 0, id)
  return next
}

/** Garde l'ordre choisi des cartes encore présentes ; celles qui arrivent se placent à la fin. */
export function syncOrder(order: string[], current: string[]): string[] {
  const kept = order.filter((id) => current.includes(id))
  return [...kept, ...current.filter((id) => !kept.includes(id))]
}

/** Actions envoyées à la fermeture de la fenêtre de la bibliothèque. */
export type ClosePileAction =
  | { type: 'reorderTop'; target: string; ids: string[] }
  | { type: 'endLook'; target: string; shuffle: boolean }

/**
 * Fermeture de la fenêtre de la bibliothèque (bouton, clic à côté ou Échap), avec la case « Mélanger en fermant » :
 * en regard, l'ordre choisi des cartes encore regardées (`seen`) est appliqué s'il a changé et sans mélange, puis le regard prend fin.
 */
export function closePileActions({ target, mode, seen, order, shuffle }: {
  target: string
  mode: 'look' | 'search' | 'browse'
  seen: string[]
  order: string[] | null
  shuffle: boolean
}): ClosePileAction[] {
  if (mode === 'browse') return []
  // Seules comptent les cartes encore regardées (une carte mise dessous ou jouée n'y est plus).
  const kept = (order ?? []).filter((id) => seen.includes(id))
  const current = seen.filter((id) => kept.includes(id))
  const reorder = mode === 'look' && !shuffle && kept.some((id, i) => id !== current[i])
  return [
    ...(reorder ? [{ type: 'reorderTop' as const, target, ids: kept }] : []),
    { type: 'endLook', target, shuffle },
  ]
}
