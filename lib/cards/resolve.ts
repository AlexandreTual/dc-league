import { getLookups, saveLookups, upsertCards } from '@/lib/db-cards'
import { lookupKey } from './parse'
import { pickFrenchPrint, toCardRow, type Identifier, type ScryfallCard, type ScryfallClient } from './scryfall'
import type { CardLookup, CardRow, ParsedLine } from './types'

export { MAX_BATCH_LINES } from './parse'

type Wanted = { key: string; name: string; set: string | null; number: string | null }

function sameName(card: ScryfallCard, name: string): boolean {
  const wanted = name.trim().replace(/\s+/g, ' ').toLowerCase()
  const full = card.name.toLowerCase()
  return full === wanted || full.split(' // ')[0] === wanted.split(' // ')[0]
}

function matches(card: ScryfallCard, w: Wanted, byName: boolean): boolean {
  if (!byName && w.set && w.number) {
    return card.set === w.set.toLowerCase() && card.collector_number === w.number
  }
  return sameName(card, w.name)
}

function identifier(w: Wanted, byName: boolean): Identifier {
  return !byName && w.set && w.number ? { set: w.set.toLowerCase(), collector_number: w.number } : { name: w.name }
}

/** Remplit le cache pour un paquet de lignes : données anglaises puis impressions françaises. */
export async function resolveLines(
  db: D1Database,
  client: ScryfallClient,
  lines: ParsedLine[],
  now: Date,
): Promise<{ resolved: number; notFound: string[] }> {
  const wantedByKey = new Map<string, Wanted>()
  for (const l of lines) {
    const key = lookupKey(l)
    if (!wantedByKey.has(key)) wantedByKey.set(key, { key, name: l.name, set: l.set, number: l.number })
  }

  const cached = await getLookups(db, [...wantedByKey.keys()])
  if (cached.error !== null) throw new Error(cached.error)
  const lookups: Record<string, CardLookup> = { ...cached.data }
  const missing = [...wantedByKey.values()].filter((w) => !lookups[w.key])

  if (missing.length > 0) {
    // 1. Données anglaises : par édition et numéro si fournis, puis par nom pour ce qui manque.
    const english = new Map<string, ScryfallCard>()
    const first = await client.fetchCollection(missing.map((w) => identifier(w, false)))
    for (const w of missing) {
      const card = first.cards.find((c) => matches(c, w, false))
      if (card) english.set(w.key, card)
    }
    const retry = missing.filter((w) => !english.has(w.key) && w.set && w.number)
    if (retry.length > 0) {
      const second = await client.fetchCollection(retry.map((w) => identifier(w, true)))
      for (const w of retry) {
        const card = second.cards.find((c) => matches(c, w, true))
        if (card) english.set(w.key, card)
      }
    }

    // 2. Impressions françaises, recherchées par oracle_id en une fois.
    const englishRows = new Map([...english].map(([key, card]) => [key, toCardRow(card)]))
    const oracleIds = [...new Set([...englishRows.values()].map((r) => r.oracle_id))]
    const frenchByOracle = new Map<string, CardRow[]>()
    if (oracleIds.length > 0) {
      for (const card of await client.searchFrenchPrints(oracleIds)) {
        const row = toCardRow(card)
        frenchByOracle.set(row.oracle_id, [...(frenchByOracle.get(row.oracle_id) ?? []), row])
      }
    }

    // 3. Enregistrement du cache, y compris les cartes introuvables et l'absence de version française.
    const rows = new Map<string, CardRow>()
    const newLookups: CardLookup[] = missing.map((w) => {
      const en = englishRows.get(w.key)
      if (!en) return { key: w.key, en_card_id: null, fr_card_id: null }
      const fr = pickFrenchPrint(frenchByOracle.get(en.oracle_id) ?? [], { set: w.set, number: w.number })
      rows.set(en.id, en)
      if (fr) rows.set(fr.id, fr)
      return { key: w.key, en_card_id: en.id, fr_card_id: fr?.id ?? null }
    })

    const saved = await upsertCards(db, [...rows.values()], now)
    if (saved.error !== null) throw new Error(saved.error)
    const savedLookups = await saveLookups(db, newLookups, now)
    if (savedLookups.error !== null) throw new Error(savedLookups.error)
    for (const l of newLookups) lookups[l.key] = l
  }

  let resolved = 0
  const notFound: string[] = []
  for (const l of lines) {
    if (lookups[lookupKey(l)]?.en_card_id) resolved++
    else notFound.push(l.name)
  }
  return { resolved, notFound }
}
