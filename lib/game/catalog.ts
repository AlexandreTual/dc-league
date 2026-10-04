import type { DeckCardView } from '@/lib/cards/types'
import type { Catalog, CatalogEntry } from './types'

/** Empreinte de la liste du deck : invalide une sauvegarde si le deck a été réimporté. */
export function fingerprintOf(entries: CatalogEntry[]): string {
  return entries.map((e) => `${e.ref}:${e.quantity}:${e.en.id}`).join('|')
}

export function buildCatalog(deckId: string, cards: DeckCardView[]): { catalog: Catalog; excluded: string[] } {
  const entries: CatalogEntry[] = []
  const excluded: string[] = []
  for (const card of cards) {
    if (!card.en) {
      excluded.push(card.requested_name)
      continue
    }
    entries.push({ ref: card.position, en: card.en, fr: card.fr, quantity: card.quantity, isCommander: card.section === 'commander' })
  }
  return { catalog: { deckId, fingerprint: fingerprintOf(entries), entries }, excluded }
}
