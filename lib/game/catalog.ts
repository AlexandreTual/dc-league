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

/** Index des entrées par référence, construit une fois par liste (refait si elle a changé de longueur). */
const indexes = new WeakMap<CatalogEntry[], { length: number; byRef: Map<number, CatalogEntry> }>()

/**
 * Entrée du catalogue pour cette référence (null : carte cachée ou jeton), sans parcourir la liste à chaque carte
 * affichée : la table la demande pour chaque carte visible à chaque rendu. Même résultat que `entries.find`.
 */
export function catalogEntry(catalog: Catalog | undefined, ref: number | null): CatalogEntry | undefined {
  if (!catalog || ref === null) return undefined
  let index = indexes.get(catalog.entries)
  if (!index || index.length !== catalog.entries.length) {
    const byRef = new Map<number, CatalogEntry>()
    for (const entry of catalog.entries) if (!byRef.has(entry.ref)) byRef.set(entry.ref, entry)
    index = { length: catalog.entries.length, byRef }
    indexes.set(catalog.entries, index)
  }
  return index.byRef.get(ref)
}
