// Client Scryfall minimal. fetch et sleep sont injectés pour pouvoir tester sans réseau.
import type { CardFace, CardRow } from './types'

const API = 'https://api.scryfall.com'
const HEADERS = { 'User-Agent': 'dc-league/1.0', Accept: 'application/json' }
const MIN_INTERVAL_MS = 100
const COLLECTION_MAX = 75
const SEARCH_GROUP = 10

export class ScryfallUnavailableError extends Error {
  constructor(status: number) {
    super(`Scryfall indisponible (HTTP ${status})`)
    this.name = 'ScryfallUnavailableError'
  }
}

export type ScryfallDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> }
export type Identifier = { set: string; collector_number: string } | { name: string }

type ImageUris = { small?: string; normal?: string }

type ScryfallFace = {
  name: string
  printed_name?: string
  mana_cost?: string
  type_line?: string
  printed_type_line?: string
  oracle_text?: string
  printed_text?: string
  colors?: string[]
  image_uris?: ImageUris
  oracle_id?: string
}

export type ScryfallCard = {
  id: string
  oracle_id?: string
  lang: string
  name: string
  printed_name?: string
  set: string
  collector_number: string
  released_at?: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  printed_type_line?: string
  oracle_text?: string
  printed_text?: string
  colors?: string[]
  color_identity?: string[]
  image_uris?: ImageUris
  card_faces?: ScryfallFace[]
}

type ListResponse = { data?: ScryfallCard[]; not_found?: Identifier[]; has_more?: boolean; next_page?: string }

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function createScryfallClient(deps: ScryfallDeps) {
  let lastCall = 0

  async function call(url: string, init: RequestInit = {}): Promise<{ status: number; body: ListResponse }> {
    if (lastCall > 0) {
      const wait = MIN_INTERVAL_MS - (Date.now() - lastCall)
      if (wait > 0) await deps.sleep(wait)
    }
    lastCall = Date.now()
    const res = await deps.fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } })
    if (res.status === 429 || res.status >= 500) throw new ScryfallUnavailableError(res.status)
    return { status: res.status, body: (await res.json()) as ListResponse }
  }

  async function fetchCollection(identifiers: Identifier[]): Promise<{ cards: ScryfallCard[]; notFound: Identifier[] }> {
    const cards: ScryfallCard[] = []
    const notFound: Identifier[] = []
    for (const part of chunks(identifiers, COLLECTION_MAX)) {
      const { body } = await call(`${API}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: part }),
      })
      cards.push(...(body.data ?? []))
      notFound.push(...(body.not_found ?? []))
    }
    return { cards, notFound }
  }

  async function searchFrenchPrints(oracleIds: string[]): Promise<ScryfallCard[]> {
    const cards: ScryfallCard[] = []
    for (const part of chunks(oracleIds, SEARCH_GROUP)) {
      const params = new URLSearchParams({
        q: `(${part.map((o) => `oracleid:${o}`).join(' or ')}) lang:fr`,
        unique: 'prints',
        order: 'released',
        dir: 'desc',
        include_extras: 'true',
      })
      let url: string | undefined = `${API}/cards/search?${params}`
      while (url) {
        const { status, body }: { status: number; body: ListResponse } = await call(url)
        if (status === 404) break
        cards.push(...(body.data ?? []))
        url = body.has_more ? body.next_page : undefined
      }
    }
    return cards
  }

  return { fetchCollection, searchFrenchPrints }
}

export type ScryfallClient = ReturnType<typeof createScryfallClient>

function toFace(face: ScryfallFace): CardFace {
  return {
    name: face.name,
    printed_name: face.printed_name ?? null,
    mana_cost: face.mana_cost ?? null,
    type_line: face.type_line ?? '',
    printed_type_line: face.printed_type_line ?? null,
    oracle_text: face.oracle_text ?? null,
    printed_text: face.printed_text ?? null,
    image_normal: face.image_uris?.normal ?? null,
    image_small: face.image_uris?.small ?? null,
  }
}

export function toCardRow(card: ScryfallCard): CardRow {
  const faces = card.card_faces?.length ? card.card_faces.map(toFace) : null
  const front = card.card_faces?.[0]
  const faceColors = card.card_faces?.flatMap((f) => f.colors ?? []) ?? []
  return {
    id: card.id,
    oracle_id: card.oracle_id ?? front?.oracle_id ?? card.id,
    lang: card.lang,
    name: card.name,
    printed_name: card.printed_name ?? null,
    set_code: card.set,
    collector_number: card.collector_number,
    released_at: card.released_at ?? null,
    mana_cost: card.mana_cost ?? front?.mana_cost ?? null,
    cmc: card.cmc ?? 0,
    type_line: card.type_line ?? front?.type_line ?? '',
    printed_type_line: card.printed_type_line ?? null,
    oracle_text: card.oracle_text ?? null,
    printed_text: card.printed_text ?? null,
    colors: card.colors ?? [...new Set(faceColors)],
    color_identity: card.color_identity ?? [],
    image_normal: card.image_uris?.normal ?? faces?.[0].image_normal ?? null,
    image_small: card.image_uris?.small ?? faces?.[0].image_small ?? null,
    faces,
  }
}

/** Impression française : même édition et numéro, sinon même édition, sinon la plus récente (première). */
export function pickFrenchPrint(prints: CardRow[], wanted: { set: string | null; number: string | null }): CardRow | null {
  const set = wanted.set?.toLowerCase() ?? null
  return (
    prints.find((p) => p.set_code === set && p.collector_number === wanted.number) ??
    prints.find((p) => p.set_code === set) ??
    prints[0] ??
    null
  )
}
