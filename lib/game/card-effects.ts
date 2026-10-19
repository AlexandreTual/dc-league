// Effets visuels des cartes en jeu (éclat d'arrivée des légendaires) : ce qui se lit dans le catalogue et la vue, sans rien révéler.
import { cardInfo } from './apply'
import type { Catalog, PlayerView, VisibleCard } from './types'

/** Permanent légendaire : ligne de type de la face montrée (version anglaise) ; jamais une carte face cachée ou inconnue. */
export function isLegendary(catalog: Catalog | undefined, card: VisibleCard): boolean {
  const info = cardInfo(catalog, card, 'en')
  if (info.hidden) return false
  return info.typeLine.split(' // ')[0].split('—')[0].split(/\s+/).includes('Legendary')
}

/** Capacités imprimées de la face montrée (mots-clés anglais de Scryfall) ; aucune pour une carte face cachée ou inconnue. */
export function printedKeywordsOf(catalog: Catalog | undefined, card: Pick<VisibleCard, 'ref' | 'token' | 'flipped' | 'faceDown'>): string[] {
  if (card.faceDown) return []
  if (card.token) return card.token.keywords ?? []
  const en = card.ref === null ? undefined : catalog?.entries.find((e) => e.ref === card.ref)?.en
  if (!en) return []
  const faces = en.faces
  if (card.flipped && faces && faces.length > 1) return faces[1].keywords ?? []
  return en.keywords ?? []
}

/** Créature (ou permanent) avec le vol imprimé sur sa face montrée. */
export const hasFlying = (catalog: Catalog | undefined, card: VisibleCard): boolean => printedKeywordsOf(catalog, card).includes('Flying')

/** Décalage d'animation propre à une carte (de 0 à -3,1 s), pour que les créatures volantes ne flottent pas ensemble. */
export function effectDelay(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 32
  return `-${hash / 10}s`
}

/** Identifiants des cartes visibles sur tous les champs de bataille. */
function battlefieldIds(view: PlayerView): Set<string> {
  return new Set(Object.values(view.players).flatMap((p) => p.zones.battlefield.flatMap((c) => (c.hidden ? [] : [c.id]))))
}

/**
 * Cartes arrivées sur un champ de bataille depuis la vue précédente (la leur ou celle d'un adversaire).
 * Aucune au premier affichage (`prev` absent) : pas d'éclat au chargement de la page ni dans une nouvelle fenêtre.
 */
export function enteredBattlefield(prev: PlayerView | null, next: PlayerView): string[] {
  if (!prev) return []
  const before = battlefieldIds(prev)
  return [...battlefieldIds(next)].filter((id) => !before.has(id))
}
