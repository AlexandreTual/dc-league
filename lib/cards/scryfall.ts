// Client Scryfall minimal. fetch et sleep sont injectés pour pouvoir tester sans réseau.
import type { CardFace, CardRow, Ruling } from './types'

const API = 'https://api.scryfall.com'
const HEADERS = { 'User-Agent': 'dc-league/1.0', Accept: 'application/json' }
// /cards/search et /cards/collection : 2 appels par seconde au plus (doc Scryfall « Rate Limits »).
const MIN_INTERVAL_MS = 500
// Un 429 bloque l'accès 30 s : on attend Retry-After (ou 30 s) avant une seule nouvelle tentative.
const RATE_LIMIT_WAIT_MS = 30_000
const TIMEOUT_MS = 10_000
const COLLECTION_MAX = 75
// La requête `q` est tronquée par Scryfall à 1000 caractères : 20 « oracleid:… » (49 caractères chacun) au plus.
const SEARCH_GROUP = 20

export class ScryfallUnavailableError extends Error {
  constructor(reason: string) {
    super(`Scryfall indisponible (${reason})`)
    this.name = 'ScryfallUnavailableError'
  }
}

export type ScryfallDeps = {
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  /** Signal d'annulation après `ms` (injectable pour les tests). */
  timeout?: (ms: number) => AbortSignal
}
export type Identifier = { set: string; collector_number: string } | { name: string } | { id: string }

/** Carte liée (jeton, emblème, pièce de combo…) listée dans `all_parts`. */
export type RelatedCard = { id: string; component: string; name: string; type_line?: string }

type ImageUris = { small?: string; normal?: string; large?: string }

type ScryfallFace = {
  name: string
  printed_name?: string
  mana_cost?: string
  type_line?: string
  printed_type_line?: string
  oracle_text?: string
  printed_text?: string
  colors?: string[]
  power?: string
  toughness?: string
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
  power?: string
  toughness?: string
  image_uris?: ImageUris
  /** « placeholder » : image anglaise barrée de « Localized Image Not Available » ; « missing » : aucune. */
  image_status?: string
  finishes?: string[]
  border_color?: string
  frame_effects?: string[]
  full_art?: boolean
  promo?: boolean
  card_faces?: ScryfallFace[]
  all_parts?: RelatedCard[]
}

type ScryfallRuling = { source?: string; published_at?: string; comment?: string }

type ListResponse = { data?: ScryfallCard[]; not_found?: Identifier[]; has_more?: boolean; next_page?: string }

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function retryAfterMs(res: Response): number {
  const seconds = Number(res.headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : RATE_LIMIT_WAIT_MS
}

export function createScryfallClient(deps: ScryfallDeps) {
  const timeout = deps.timeout ?? ((ms: number) => AbortSignal.timeout(ms))
  // L'appel précédent peut venir de la requête d'import précédente : on compte l'intervalle dès la création.
  let lastCall = Date.now()

  async function send(url: string, init: RequestInit): Promise<Response> {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCall)
    if (wait > 0) await deps.sleep(wait)
    try {
      return await deps.fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) }, signal: timeout(TIMEOUT_MS) })
    } catch (e) {
      throw new ScryfallUnavailableError((e as Error).message)
    } finally {
      lastCall = Date.now()
    }
  }

  async function call<B = ListResponse>(url: string, init: RequestInit = {}): Promise<{ status: number; body: B }> {
    let res = await send(url, init)
    if (res.status === 429) {
      await deps.sleep(retryAfterMs(res))
      res = await send(url, init)
    }
    // 404 = recherche sans résultat ; tout autre code d'erreur est traité comme une indisponibilité.
    if (!res.ok && res.status !== 404) throw new ScryfallUnavailableError(`HTTP ${res.status}`)
    try {
      return { status: res.status, body: (await res.json()) as B }
    } catch {
      throw new ScryfallUnavailableError('réponse illisible')
    }
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

  /** Une seule page de résultats (175 impressions) par groupe, de la plus récente à la plus ancienne. */
  async function searchPage(oracleIds: string[]): Promise<ListResponse> {
    const params = new URLSearchParams({
      q: `(${oracleIds.map((o) => `oracleid:${o}`).join(' or ')}) lang:fr`,
      unique: 'prints',
      order: 'released',
      dir: 'desc',
      include_extras: 'true',
    })
    const { status, body } = await call(`${API}/cards/search?${params}`)
    return status === 404 ? { data: [], has_more: false } : body
  }

  /**
   * Impressions françaises des cartes demandées. Les pages suivantes ne sont jamais lues (une carte de base
   * compte plus de 400 impressions françaises) ; si la page est pleine, les cartes qu'elle ne contient pas
   * sont recherchées à nouveau sans celles qui l'ont remplie.
   */
  async function searchFrenchPrints(oracleIds: string[]): Promise<ScryfallCard[]> {
    const cards: ScryfallCard[] = []
    for (const part of chunks(oracleIds, SEARCH_GROUP)) {
      let pending = part
      while (pending.length > 0) {
        const body = await searchPage(pending)
        const data = body.data ?? []
        cards.push(...data)
        if (!body.has_more || data.length === 0) break
        const seen = new Set(data.map((c) => c.oracle_id ?? c.card_faces?.[0]?.oracle_id))
        pending = pending.filter((o) => !seen.has(o))
      }
    }
    return cards
  }

  /** Règles d'une carte (identiques pour toutes ses impressions), de la plus ancienne à la plus récente. */
  async function fetchRulings(cardId: string): Promise<Ruling[]> {
    const { status, body } = await call<{ data?: ScryfallRuling[] }>(`${API}/cards/${encodeURIComponent(cardId)}/rulings`)
    if (status === 404) return []
    return (body.data ?? []).map((r) => ({
      date: r.published_at ?? '',
      source: r.source === 'wotc' ? 'wotc' : 'scryfall',
      text: r.comment ?? '',
    }))
  }

  return { fetchCollection, searchFrenchPrints, fetchRulings }
}

export type ScryfallClient = ReturnType<typeof createScryfallClient>

/** Scryfall n'a pas de scan de cette impression (fréquent pour les vieilles éditions en français). */
function withoutRealImage(card: ScryfallCard): boolean {
  return card.image_status === 'placeholder' || card.image_status === 'missing'
}

function toFace(face: ScryfallFace, hasImage: boolean): CardFace {
  return {
    name: face.name,
    printed_name: face.printed_name ?? null,
    mana_cost: face.mana_cost ?? null,
    type_line: face.type_line ?? '',
    printed_type_line: face.printed_type_line ?? null,
    oracle_text: face.oracle_text ?? null,
    printed_text: face.printed_text ?? null,
    image_normal: hasImage ? face.image_uris?.normal ?? null : null,
    image_large: hasImage ? face.image_uris?.large ?? null : null,
    image_small: hasImage ? face.image_uris?.small ?? null : null,
    power: face.power ?? null,
    toughness: face.toughness ?? null,
  }
}

/** Nom imprimé : celui de la carte, sinon celui des faces (cartes recto-verso et doubles) joints par « // ». */
function printedName(card: ScryfallCard): string | null {
  if (card.printed_name) return card.printed_name
  const faces = card.card_faces ?? []
  if (!faces.some((f) => f.printed_name)) return null
  return faces.map((f) => f.printed_name || f.name).join(' // ')
}

/** Carte enregistrée ; sans image quand Scryfall n'a pas de vrai scan, pour retomber sur l'image anglaise. */
export function toCardRow(card: ScryfallCard): CardRow {
  const hasImage = !withoutRealImage(card)
  const faces = card.card_faces?.length ? card.card_faces.map((f) => toFace(f, hasImage)) : null
  const front = card.card_faces?.[0]
  const faceColors = card.card_faces?.flatMap((f) => f.colors ?? []) ?? []
  return {
    id: card.id,
    oracle_id: card.oracle_id ?? front?.oracle_id ?? card.id,
    lang: card.lang,
    name: card.name,
    printed_name: printedName(card),
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
    image_normal: (hasImage ? card.image_uris?.normal : null) ?? faces?.[0].image_normal ?? null,
    image_large: (hasImage ? card.image_uris?.large : null) ?? faces?.[0].image_large ?? null,
    image_small: (hasImage ? card.image_uris?.small : null) ?? faces?.[0].image_small ?? null,
    faces,
    // Carte à plusieurs faces : celles du recto (une carte d'aventure ou recto-verso n'en a pas à la racine).
    power: card.power ?? front?.power ?? null,
    toughness: card.toughness ?? front?.toughness ?? null,
  }
}

/** Impression française candidate : la carte, plus la qualité de son image et son style. */
export type FrenchPrint = CardRow & {
  /** Scan en haute définition (image nette). */
  highres: boolean
  /** Version classique : ni foil seul, ni gravée, ni sans bordure, showcase, illustration étendue, pleine illustration ou promo. */
  classic: boolean
}

const SPECIAL_FRAMES = ['showcase', 'extendedart', 'etched', 'inverted']

export function toFrenchPrint(card: ScryfallCard): FrenchPrint {
  const classic =
    (!card.finishes || card.finishes.includes('nonfoil')) &&
    card.border_color !== 'borderless' &&
    !card.frame_effects?.some((f) => SPECIAL_FRAMES.includes(f)) &&
    !card.full_art &&
    !card.promo
  return { ...toCardRow(card), highres: card.image_status === 'highres_scan', classic }
}

/**
 * Impression française, de la plus récente à la plus ancienne dans `prints` :
 * 1. celle demandée (même édition et numéro) si son scan est net ;
 * 2. sinon la plus récente classique au scan net ;
 * 3. sinon une vraie image : celle demandée, puis même édition (classique), puis la plus récente classique ;
 * 4. sinon aucune vraie image : celle demandée, même édition ou la plus récente, pour le texte français
 *    (l'image anglaise y est ajoutée à l'import).
 * Une version foil ou spéciale n'est jamais choisie à la place de celle demandée.
 */
export function pickFrenchPrint<T extends CardRow & Partial<Pick<FrenchPrint, 'highres' | 'classic'>>>(
  prints: T[],
  wanted: { set: string | null; number: string | null },
): T | null {
  const set = wanted.set?.toLowerCase() ?? null
  const asked = (p: T) => p.set_code === set && p.collector_number === wanted.number
  const sameSet = (p: T) => p.set_code === set
  const image = (p: T) => p.image_normal !== null
  const classic = (p: T) => p.classic !== false
  return (
    prints.find((p) => asked(p) && image(p) && p.highres) ??
    prints.find((p) => classic(p) && image(p) && p.highres) ??
    prints.find((p) => asked(p) && image(p)) ??
    prints.find((p) => sameSet(p) && classic(p) && image(p)) ??
    prints.find((p) => classic(p) && image(p)) ??
    prints.find((p) => asked(p)) ??
    prints.find((p) => sameSet(p) && classic(p)) ??
    prints.find((p) => classic(p) && !image(p)) ??
    null
  )
}
