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
