import type { CardFace, CardRow } from './types'

/** Impression demandée par la liste du deck (édition et numéro), null pour un import sans édition. */
export type AskedPrint = { set: string | null; number: string | null }

const isPrint = (card: CardRow, asked: AskedPrint) =>
  card.set_code === asked.set?.toLowerCase() && card.collector_number === asked.number

const images = (from: CardFace | CardRow | undefined) => ({
  image_normal: from?.image_normal ?? null,
  image_large: from?.image_large ?? null,
  image_small: from?.image_small ?? null,
})

/**
 * Visuel du joueur (issue #158) : quand la française retenue n'est pas l'impression demandée (absente en français,
 * ou seulement en basse définition), elle garde son nom et son texte mais prend les images de l'impression anglaise
 * demandée — celle du deck papier. Calculé à l'affichage, sans rien enregistrer : les decks déjà importés en profitent.
 */
export function playerVisual(fr: CardRow | null, en: CardRow | null, asked: AskedPrint): CardRow | null {
  if (!fr || !en?.image_normal || !asked.set || !asked.number) return fr
  if (isPrint(fr, asked) || !isPrint(en, asked)) return fr
  return { ...fr, ...images(en), faces: fr.faces?.map((f, i) => ({ ...f, ...images(en.faces?.[i]) })) ?? null }
}
