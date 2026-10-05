// Récupération d'une liste de deck depuis un lien Moxfield ou Archidekt, convertie au format de l'import texte.

export type DeckLink = { site: 'moxfield' | 'archidekt'; id: string }
export type DeckLinkResult = { ok: true; text: string; name: string | null } | { ok: false; error: string }

const SITE_NAMES = { moxfield: 'Moxfield', archidekt: 'Archidekt' } as const
const FETCH_TIMEOUT_MS = 10_000

/** Reconnaît un lien de deck Moxfield (`/decks/<id>`) ou Archidekt (`/decks/<numéro>`), sinon null. */
export function parseDeckLink(input: string): DeckLink | null {
  const raw = input.trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const [first, id] = url.pathname.split('/').filter(Boolean)
  if (first !== 'decks' || !id) return null
  if (host === 'moxfield.com' && /^[A-Za-z0-9_-]+$/.test(id)) return { site: 'moxfield', id }
  if (host === 'archidekt.com' && /^\d+$/.test(id)) return { site: 'archidekt', id }
  return null
}

type Entry = { quantity: number; name: string; set?: string; number?: string }

const line = (e: Entry) => `${e.quantity} ${e.name}${e.set && e.number ? ` (${e.set}) ${e.number}` : ''}`

/** Texte « Commander / Deck » ; null s'il n'y a aucune carte. */
function toText(commanders: Entry[], main: Entry[]): string | null {
  if (commanders.length + main.length === 0) return null
  const parts: string[] = []
  if (commanders.length > 0) parts.push(['Commander', ...commanders.map(line)].join('\n'))
  if (main.length > 0) parts.push(['Deck', ...main.map(line)].join('\n'))
  return parts.join('\n\n')
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

function validEntry(quantity: unknown, name: unknown, set: unknown, number: unknown): Entry | null {
  const n = str(name)
  if (!n || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return null
  return { quantity, name: n, set: str(set), number: str(number) }
}

/** Réponse de l'API Moxfield (v3) → texte ; commandants et deck principal seulement. */
export function moxfieldToText(data: unknown): string | null {
  if (!isObject(data) || !isObject(data.boards)) return null
  const board = (key: string): Entry[] => {
    const b = (data.boards as Record<string, unknown>)[key]
    if (!isObject(b) || !isObject(b.cards)) return []
    return Object.values(b.cards).flatMap((c) => {
      if (!isObject(c) || !isObject(c.card)) return []
      const e = validEntry(c.quantity, c.card.name, c.card.set, c.card.cn)
      return e ? [e] : []
    })
  }
  return toText(board('commanders'), board('mainboard'))
}

/**
 * Réponse de l'API Archidekt → texte. Une carte compte selon sa première catégorie : ignorée si cette
 * catégorie est hors du deck (Maybeboard, Sideboard…), commandant si c'est la catégorie « premier ».
 */
export function archidektToText(data: unknown): string | null {
  if (!isObject(data) || !Array.isArray(data.cards)) return null
  const categories = new Map<string, { included: boolean; premier: boolean }>()
  for (const c of Array.isArray(data.categories) ? data.categories : []) {
    if (isObject(c) && typeof c.name === 'string') {
      categories.set(c.name, { included: c.includedInDeck !== false, premier: c.isPremier === true || c.name === 'Commander' })
    }
  }
  const commanders: Entry[] = []
  const main: Entry[] = []
  for (const c of data.cards) {
    if (!isObject(c) || !isObject(c.card)) continue
    const oracle = isObject(c.card.oracleCard) ? c.card.oracleCard : {}
    const edition = isObject(c.card.edition) ? c.card.edition : {}
    const e = validEntry(c.quantity, oracle.name, edition.editioncode, c.card.collectorNumber)
    if (!e) continue
    const primary = Array.isArray(c.categories) && typeof c.categories[0] === 'string' ? c.categories[0] : null
    const category = primary ? categories.get(primary) ?? { included: true, premier: primary === 'Commander' } : null
    if (category && !category.included) continue
    ;(category?.premier ? commanders : main).push(e)
  }
  return toText(commanders, main)
}

const API = {
  moxfield: (id: string) => `https://api2.moxfield.com/v3/decks/all/${id}`,
  archidekt: (id: string) => `https://archidekt.com/api/decks/${id}/`,
}

const refused = (site: DeckLink['site']) =>
  site === 'moxfield'
    ? 'Moxfield refuse la récupération automatique : sur Moxfield, fais Export → Copier, puis colle la liste ici'
    : 'Archidekt ne répond pas : réessaie, ou copie la liste depuis Archidekt (Export) et colle-la ici'

/** Lit le deck sur le site et le convertit ; tous les échecs deviennent un message en français. */
export async function fetchDeckLink(link: DeckLink, fetcher: typeof fetch): Promise<DeckLinkResult> {
  const site = SITE_NAMES[link.site]
  let data: unknown
  try {
    const res = await fetcher(API[link.site](link.id), {
      headers: { Accept: 'application/json', 'User-Agent': 'CommanderLeague/1.0 (import de deck)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (res.status === 404) return { ok: false, error: `Deck introuvable ou privé sur ${site}` }
    if (!res.ok) return { ok: false, error: refused(link.site) }
    data = await res.json()
  } catch {
    return { ok: false, error: refused(link.site) }
  }
  const text = link.site === 'moxfield' ? moxfieldToText(data) : archidektToText(data)
  if (!text) return { ok: false, error: `Aucune carte trouvée dans ce deck ${site}` }
  return { ok: true, text, name: isObject(data) ? str(data.name) ?? null : null }
}
