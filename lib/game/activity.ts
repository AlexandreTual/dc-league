// Repères d'activité de la table : ce qui a changé entre deux vues successives d'un joueur.
import type { PlayerView, VisibleCard } from './types'

export type Activity = { changed: string[]; lines: { actor: string; text: string; roll?: true }[] }

/** Empreinte de chaque carte visible : zone, position et état. */
function fingerprints(view: PlayerView): Map<string, string> {
  const out = new Map<string, string>()
  const add = (player: string, zone: string, c: VisibleCard) => {
    const { plus, minus, other } = c.counters
    out.set(c.id, [player, zone, c.tapped, c.flipped, c.faceDown, plus, minus, other, c.x, c.y].join('|'))
  }
  for (const [player, p] of Object.entries(view.players)) {
    const { library, ...zones } = p.zones
    for (const [zone, cards] of Object.entries(zones)) for (const c of cards) if (!c.hidden) add(player, zone, c)
    for (const { card } of library.visible) add(player, 'library', card)
  }
  return out
}

/**
 * Cartes visibles nouvelles ou modifiées (les cartes disparues sont ignorées) et lignes du journal
 * ajoutées par les autres joueurs (lancers de dés compris les miens). Sans vue précédente (connexion, reconnexion) : rien.
 */
export function diffViews(prev: PlayerView | null, next: PlayerView, me: string | null): Activity {
  if (!prev) return { changed: [], lines: [] }
  const before = fingerprints(prev)
  const changed: string[] = []
  for (const [id, print] of fingerprints(next)) if (before.get(id) !== print) changed.push(id)
  // Le journal envoyé est tronqué : on compare les rangs de fin dans le journal complet.
  const count = (next.logStart ?? 0) + next.log.length - ((prev.logStart ?? 0) + prev.log.length)
  const added = count > 0 ? next.log.slice(-Math.min(count, next.log.length)) : []
  const lines = added
    .filter((l) => me === null || l.actor !== me || l.roll)
    .map((l) => (l.roll ? { actor: l.actor ?? '', text: l.text, roll: true as const } : { actor: l.actor ?? '', text: l.text }))
  return { changed, lines }
}
