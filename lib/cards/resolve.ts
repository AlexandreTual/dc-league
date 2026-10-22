import { getLookups, saveLookups, upsertCards } from '@/lib/db-cards'
import { foldText } from '@/lib/text'
import { lookupKey } from './parse'
import { pickFrenchPrint, ScryfallUnavailableError, toCardRow, toFrenchPrint, type FrenchPrint, type Identifier, type ScryfallCard, type ScryfallClient } from './scryfall'
import type { CardFace, CardLookup, CardRow, ParsedLine, StoredCardLookup } from './types'

export { MAX_BATCH_LINES } from './parse'

/** Une recherche sans résultat (carte introuvable ou sans version française) est retentée après ce délai. */
export const NEGATIVE_CACHE_MS = 7 * 24 * 60 * 60 * 1000

type Wanted = { key: string; name: string; set: string | null; number: string | null }

/** Nom comparable : minuscules, espaces réduits, sans accents (« Lim-Dûl » = « Lim-Dul »). */
function plainName(name: string): string {
  return foldText(name).trim().replace(/\s+/g, ' ')
}

const frontFace = (name: string) => name.split(' // ')[0]

// Une carte double se demande aussi par sa face arrière ou sa partie aventure (« Insectile Aberration »).
function sameName(card: ScryfallCard, name: string): boolean {
  const wanted = plainName(name)
  const full = plainName(card.name)
  if (full === wanted || frontFace(full) === frontFace(wanted)) return true
  const faces = card.card_faces?.length ? card.card_faces.map((f) => f.name) : card.name.split(' // ')
  return faces.some((f) => plainName(f) === wanted)
}

const oracleOf = (card: ScryfallCard) => card.oracle_id ?? card.card_faces?.[0]?.oracle_id

// Nom imprimé d'une impression française : nom complet, face avant ou l'une des faces.
function samePrintedName(card: ScryfallCard, name: string): boolean {
  const wanted = plainName(name)
  const printed = [card.printed_name, ...(card.card_faces ?? []).map((f) => f.printed_name)].filter((n): n is string => !!n)
  return printed.some((p) => plainName(p) === wanted || frontFace(plainName(p)) === frontFace(wanted))
}

/** Entrée à (re)chercher : absente, ou négative et plus vieille que NEGATIVE_CACHE_MS. */
function isStale(lookup: StoredCardLookup | undefined, now: Date): boolean {
  if (!lookup) return true
  if (lookup.en_card_id && lookup.fr_card_id) return false
  const fetched = Date.parse(lookup.fetched_at)
  return !Number.isFinite(fetched) || now.getTime() - fetched > NEGATIVE_CACHE_MS
}

// Une édition (et un numéro) qui désignent une autre carte (faute de frappe, numérotation d'un autre site)
// ne la remplacent pas : la ligne repart dans la recherche par nom.
function matches(card: ScryfallCard, w: Wanted, byName: boolean): boolean {
  if (!byName && w.set && (card.set !== w.set.toLowerCase() || (w.number && card.collector_number !== w.number))) return false
  return sameName(card, w.name)
}

// Scryfall ne trouve pas une carte double par son nom complet « A // B », seulement par sa face avant.
// Une édition sans numéro (« 1 Sol Ring (C21) ») se cherche par nom plus édition.
function identifier(w: Wanted, byName: boolean): Identifier {
  const name = frontFace(w.name).trim()
  if (byName || !w.set) return { name }
  return w.number ? { set: w.set.toLowerCase(), collector_number: w.number } : { name, set: w.set.toLowerCase() }
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
export type ImportClient = Pick<ScryfallClient, 'fetchCollection' | 'searchFrenchPrints' | 'searchFrenchNames'>

/**
 * Lignes écrites avec le nom français : `/cards/collection` ne connaît que les noms anglais. On cherche
 * ces noms parmi les impressions françaises, puis la carte anglaise de même oracle_id (celle de l'édition
 * et du numéro demandés s'ils correspondent, sinon celle du nom anglais).
 */
async function fetchByFrenchName(client: ImportClient, unresolved: Wanted[], english: Map<string, ScryfallCard>) {
  const frenchCards = await client.searchFrenchNames([...new Set(unresolved.map((w) => frontFace(w.name).trim()))])
  const found = unresolved.flatMap((w) => {
    const fr = frenchCards.find((c) => samePrintedName(c, w.name))
    return fr ? [{ w, fr }] : []
  })
  if (found.length === 0) return
  const identifiers = new Map<string, Identifier>()
  for (const { w, fr } of found) {
    const ids: Identifier[] = [{ name: frontFace(fr.name).trim() }]
    if (w.set && w.number) ids.push({ set: w.set.toLowerCase(), collector_number: w.number })
    for (const id of ids) identifiers.set(JSON.stringify(id), id)
  }
  const { cards } = await client.fetchCollection([...identifiers.values()])
  for (const { w, fr } of found) {
    const same = cards.filter((c) => oracleOf(c) === oracleOf(fr))
    const card = same.find((c) => !!w.set && c.set === w.set.toLowerCase() && c.collector_number === w.number) ?? same[0]
    if (card) english.set(w.key, card)
  }
}

/** Données anglaises puis impressions françaises des cartes à (re)chercher. */
async function fetchFromScryfall(client: ImportClient, missing: Wanted[]) {
  // 1. Données anglaises : par édition (et numéro) si fournis, puis par nom pour ce qui manque.
  const english = new Map<string, ScryfallCard>()
  const first = await client.fetchCollection(missing.map((w) => identifier(w, false)))
  for (const w of missing) {
    const card = first.cards.find((c) => matches(c, w, false))
    if (card) english.set(w.key, card)
  }
  const retry = missing.filter((w) => !english.has(w.key) && w.set)
  if (retry.length > 0) {
    const second = await client.fetchCollection(retry.map((w) => identifier(w, true)))
    for (const w of retry) {
      const card = second.cards.find((c) => matches(c, w, true))
      if (card) english.set(w.key, card)
    }
  }

  const unresolved = missing.filter((w) => !english.has(w.key))
  if (unresolved.length > 0) await fetchByFrenchName(client, unresolved, english)

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
