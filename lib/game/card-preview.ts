// Grande image d'une carte (aperçu au survol, menu ouvert au doigt) : une seule règle pour ne jamais montrer une carte cachée.

import { cardInfo } from './apply'
import type { Catalog, CardView } from './types'

/** Nom et images d'une carte à montrer en grand ; null pour une carte absente, cachée, face cachée ou sans image. */
export function cardPreview(card: CardView | null | undefined, catalog: Catalog | undefined, lang: 'fr' | 'en') {
  if (!card || card.hidden) return null
  const data = cardInfo(catalog, card, lang)
  if (data.hidden || !data.image) return null
  return { name: data.name, image: data.image, imageLarge: data.imageLarge }
}

export type CardPreview = NonNullable<ReturnType<typeof cardPreview>>
