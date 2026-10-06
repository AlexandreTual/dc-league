import type { CardFace, CardRow } from './types'

// Images de cartes Scryfall : « normal » (488 × 680) partout, « large » (672 × 936) pour les grands affichages.

/**
 * srcset proposant les deux tailles : avec `sizes`, le navigateur prend la plus petite qui reste nette
 * pour la taille affichée et la densité de l'écran (issue #20). Sans image large : pas de srcset.
 */
export function cardSrcSet(normal: string, large: string | null | undefined): string | undefined {
  return large ? `${normal} 488w, ${large} 672w` : undefined
}

/** Numérisations floues chez Scryfall ; un état inconnu (carte enregistrée avant) n'est pas traité. */
const BLURRY = new Set(['lowres', 'placeholder', 'missing'])

/** Illustration de l'impression ; pour une carte recto-verso, celle de sa face avant. */
function illustrationOf(row: CardRow): string | null {
  return row.illustration_id ?? row.faces?.[0]?.illustration_id ?? null
}

export function isBlurry(row: CardRow): boolean {
  return BLURRY.has(row.image_status ?? '')
}

/**
 * Impression nette dont prendre les images quand `row` est floue (foils, promos, Secret Lair, The List…) :
 * même carte, même illustration, numérisée en haute définition, dans la même langue de préférence
 * (texte français sur l'image). Null si `row` est nette ou si aucune impression ne convient : on garde son image.
 */
export function sharpSource(row: CardRow, candidates: CardRow[]): CardRow | null {
  if (!isBlurry(row)) return null
  const illustration = illustrationOf(row)
  if (!illustration) return null
  const sharp = candidates.filter(
    (c) => c.id !== row.id && c.oracle_id === row.oracle_id && c.image_status === 'highres_scan' &&
      illustrationOf(c) === illustration && c.image_normal,
  )
  return sharp.find((c) => c.lang === row.lang) ?? sharp[0] ?? null
}

type Images = Pick<CardFace, 'image_normal' | 'image_large' | 'image_small'>

const imagesOf = (from: Images): Images => ({
  image_normal: from.image_normal,
  image_large: from.image_large ?? null,
  image_small: from.image_small,
})

/** `row` avec les images de `source` : nom, texte, langue et édition restent ceux de `row`. Faces : même rang. */
export function withImagesOf(row: CardRow, source: CardRow): CardRow {
  return {
    ...row,
    ...imagesOf(source),
    faces: row.faces?.map((f, i) => (source.faces?.[i] ? { ...f, ...imagesOf(source.faces[i]) } : f)) ?? null,
  }
}
