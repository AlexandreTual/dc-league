// Effets visuels des cartes en jeu (reflet des légendaires) : ce qui se lit dans le catalogue, sans rien révéler.
import { cardInfo } from './apply'
import type { Catalog, VisibleCard } from './types'

/** Permanent légendaire : ligne de type de la face montrée (version anglaise) ; jamais une carte face cachée ou inconnue. */
export function isLegendary(catalog: Catalog | undefined, card: VisibleCard): boolean {
  const info = cardInfo(catalog, card, 'en')
  if (info.hidden) return false
  return info.typeLine.split(' // ')[0].split('—')[0].split(/\s+/).includes('Legendary')
}

/** Décalage d'animation propre à une carte (de 0 à -6,9 s), pour que les effets ne soient pas synchronisés. */
export function effectDelay(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 70
  return `-${hash / 10}s`
}
