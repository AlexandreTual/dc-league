// Grande image d'une carte (aperçu au survol, menu ouvert au doigt) : une seule règle pour ne jamais montrer une carte cachée.

import type { Messages } from '@/lib/i18n/messages'
import { abilitiesSummary } from './abilities'
import { cardInfo } from './apply'
import type { Catalog, CardView } from './types'

/**
 * Nom et images d'une carte à montrer en grand, et ses capacités données ou perdues en toutes lettres (s'il y en a) ;
 * dans la langue de `t` ; null pour une carte absente, cachée, face cachée ou sans image.
 */
export function cardPreview(card: CardView | null | undefined, catalog: Catalog | undefined, lang: 'fr' | 'en', t: Messages) {
  if (!card || card.hidden) return null
  const data = cardInfo(catalog, card, lang)
  if (data.hidden || !data.image) return null
  const abilities = abilitiesSummary(card, t)
  return { name: data.name, image: data.image, imageLarge: data.imageLarge, ...(abilities.length > 0 ? { abilities } : {}) }
}

export type CardPreview = NonNullable<ReturnType<typeof cardPreview>>
