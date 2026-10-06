import { getLookups, saveLookups, upsertCards } from '@/lib/db-cards'
import { lookupKey } from './parse'
import { pickFrenchPrint, ScryfallUnavailableError, toCardRow, toFrenchPrint, type FrenchPrint, type Identifier, type ScryfallCard, type ScryfallClient } from './scryfall'
import type { CardFace, CardLookup, CardRow, ParsedLine, StoredCardLookup } from './types'

export { MAX_BATCH_LINES } from './parse'

/** Une recherche sans résultat (carte introuvable ou sans version française) est retentée après ce délai. */
export const NEGATIVE_CACHE_MS = 7 * 24 * 60 * 60 * 1000

type Wanted = { key: string; name: string; set: string | null; number: string | null }

/** Nom comparable : minuscules, espaces réduits, sans accents (« Lim-Dûl » = « Lim-Dul »). */
function plainName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

const frontFace = (name: string) => name.split(' // ')[0]

function sameName(card: ScryfallCard, name: string): boolean {
  const wanted = plainName(name)
  const full = plainName(card.name)
  return full === wanted || frontFace(full) === frontFace(wanted)
}

/** Entrée à (re)chercher : absente, ou négative et plus vieille que NEGATIVE_CACHE_MS. */
function isStale(lookup: StoredCardLookup | undefined, now: Date): boolean {
  if (!lookup) return true
  if (lookup.en_card_id && lookup.fr_card_id) return false
  const fetched = Date.parse(lookup.fetched_at)
  return !Number.isFinite(fetched) || now.getTime() - fetched > NEGATIVE_CACHE_MS
}

function matches(card: ScryfallCard, w: Wanted, byName: boolean): boolean {
  if (!byName && w.set && w.number) {
    return card.set === w.set.toLowerCase() && card.collector_number === w.number
  }
  return sameName(card, w.name)
}

// Scryfall ne trouve pas une carte double par son nom complet « A // B », seulement par sa face avant.
function identifier(w: Wanted, byName: boolean): Identifier {
  return !byName && w.set && w.number
    ? { set: w.set.toLowerCase(), collector_number: w.number }
    : { name: frontFace(w.name).trim() }
}

/** Version française sans vraie image : nom et texte français, image de la version anglaise. */
function withEnglishImages(fr: FrenchPrint, en: CardRow): CardRow {
  const { highres: _h, classic: _c, ...row } = fr
  if (row.image_normal) return row
  const images = (from: CardFace | CardRow | undefined) => ({
    image_normal: from?.image_normal ?? null,
    image_large: from?.image_large ?? null,
    image_small: from?.image_small ?? null,
  })
  return { ...row, ...images(en), faces: row.faces?.map((f, i) => ({ ...f, ...images(en.faces?.[i]) })) ?? null }
}

/** Ce que l'import utilise du client Scryfall. */
export type ImportClient = Pick<ScryfallClient, 'fetchCollection' | 'searchFrenchPrints'>

/** Données anglaises puis impressions françaises des cartes à (re)chercher. */
async function fetchFromScryfall(client: ImportClient, missing: Wanted[]) {
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
  const frenchByOracle = new Map<string, FrenchPrint[]>()
  if (oracleIds.length > 0) {
    for (const card of await client.searchFrenchPrints(oracleIds)) {
      const row = toFrenchPrint(card)
      frenchByOracle.set(row.oracle_id, [...(frenchByOracle.get(row.oracle_id) ?? []), row])
    }
  }
  return { englishRows, frenchByOracle }
}

/** Remplit le cache pour un paquet de lignes : données anglaises puis impressions françaises. */
export async function resolveLines(
  db: D1Database,
  client: ImportClient,
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
  const missing = [...wantedByKey.values()].filter((w) => isStale(cached.data[w.key], now))

  if (missing.length > 0) {
    let fetched: Awaited<ReturnType<typeof fetchFromScryfall>> | null
    try {
      fetched = await fetchFromScryfall(client, missing)
    } catch (e) {
      // Simple rafraîchissement d'entrées négatives déjà en cache : on garde le cache plutôt que d'échouer.
      if (!(e instanceof ScryfallUnavailableError) || !missing.every((w) => cached.data[w.key])) throw e
      fetched = null
    }

    if (fetched) {
      // 3. Enregistrement du cache, y compris les cartes introuvables et l'absence de version française.
      const { englishRows, frenchByOracle } = fetched
      const rows = new Map<string, CardRow>()
      const newLookups: CardLookup[] = missing.map((w) => {
        const en = englishRows.get(w.key)
        if (!en) return { key: w.key, en_card_id: null, fr_card_id: null }
        const picked = pickFrenchPrint(frenchByOracle.get(en.oracle_id) ?? [], { set: w.set, number: w.number })
        const fr = picked && withEnglishImages(picked, en)
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
  }

  let resolved = 0
  const notFound: string[] = []
  for (const l of lines) {
    if (lookups[lookupKey(l)]?.en_card_id) resolved++
    else notFound.push(l.name)
  }
  return { resolved, notFound }
}
