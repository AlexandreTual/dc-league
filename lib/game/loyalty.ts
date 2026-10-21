// Loyauté d'un planeswalker en jeu : imprimée, plus l'écart des marqueurs loyauté ajoutés ou retirés.
import { cardInfo } from './apply'
import { catalogEntry } from './catalog'
import { valueOf, type PtValue } from './pt'
import type { CardInstance, Catalog } from './types'

/** Plus grand écart gardé, dans un sens comme dans l'autre. */
export const MAX_LOYALTY_MOD = 999

type LoyaltyCard = Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown' | 'loyaltyMod'>

/**
 * Loyauté imprimée de la face visible (verso d'une carte transformée). Null pour une carte face cachée, un jeton,
 * une carte sans loyauté ou dont la loyauté est inconnue (carte enregistrée avant son ajout, serveur de jeu plus ancien).
 */
export function baseLoyalty(catalog: Catalog | undefined, card: Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown'>): string | null {
  if (card.faceDown || card.token) return null
  const entry = catalogEntry(catalog, card.ref)
  if (!entry) return null
  const faces = entry.en.faces
  if (card.flipped && faces && faces.length > 1) return faces[1].loyalty ?? null
  return entry.en.loyalty ?? null
}

/**
 * Loyauté affichée ; sans loyauté connue, seulement l'écart, et null s'il est nul (rien à afficher).
 * Null face cachée : la carte n'est alors qu'une créature 2/2.
 */
export function loyaltyStats(catalog: Catalog | undefined, card: LoyaltyCard): PtValue | null {
  if (card.faceDown) return null
  const base = baseLoyalty(catalog, card)
  const delta = card.loyaltyMod ?? 0
  if (base === null && delta === 0) return null
  return valueOf(base, delta)
}

/** La carte peut porter des marqueurs loyauté : loyauté imprimée, planeswalker (loyauté pas encore lue) ou déjà modifiée. */
export function hasLoyalty(catalog: Catalog | undefined, card: LoyaltyCard): boolean {
  if (card.faceDown) return false
  if (baseLoyalty(catalog, card) !== null || (card.loyaltyMod ?? 0) !== 0) return true
  return cardInfo(catalog, card, 'en').typeLine.split(' // ')[0].includes('Planeswalker')
}

/**
 * Écart à appliquer, borné : jamais au-delà de MAX_LOYALTY_MOD, et jamais sous 0 marqueur quand la loyauté
 * imprimée est un nombre.
 */
export function clampLoyalty(base: string | null, mod: number): number {
  const floor = base !== null && /^\d+$/.test(base) ? Math.max(-Number(base), -MAX_LOYALTY_MOD) : -MAX_LOYALTY_MOD
  return Math.max(floor, Math.min(MAX_LOYALTY_MOD, mod))
}
