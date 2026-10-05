import type { ParsedLine, Section } from './types'

export const MAX_CARD_LINES = 250

export type ParseResult = {
  lines: ParsedLine[]
  ignored: number
  errors: { lineNumber: number; text: string }[]
  tooLong: boolean
}

const SECTION_HEADERS: Record<string, Section | 'ignore'> = {
  commander: 'commander',
  commanders: 'commander',
  deck: 'main',
  main: 'main',
  mainboard: 'main',
  sideboard: 'ignore',
  maybeboard: 'ignore',
  considering: 'ignore',
  tokens: 'ignore',
}

// quantité optionnelle (« 1 », « 1x », « 1X », « 1 x »), nom, puis éventuellement "(SET) numéro",
// puis des marques *F* ignorées
const CARD_LINE = /^(?:(\d+)\s*(?:[xX]\s+|\s+))?(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+(\S+))?((?:\s+\*[A-Za-z]+\*)*)$/
// catégories Archidekt en fin de ligne : « [Ramp] », « [Commander{top}] », « [Ramp,Draw] »
const CATEGORIES = /\s*\[([^\]]*)\]$/
// réserve au format MTGO / Arena : « SB: 1 Duress »
const SIDEBOARD_LINE = /^SB:/i

function headerOf(line: string): Section | 'ignore' | null {
  const word = line
    .replace(/^\/\/\s*/, '')
    .replace(/:$/, '')
    .replace(/\s*\(\d+\)$/, '') // « Commander (1) », « Deck (99) »
    .trim()
    .toLowerCase()
  return SECTION_HEADERS[word] ?? null
}

/**
 * Retire les catégories finales et indique si l'une d'elles est « Commander », ou si la carte est hors du deck
 * (catégorie Sideboard / Maybeboard, ou marquée {noDeck} par Archidekt).
 */
function splitCategories(line: string): { line: string; commander: boolean; outOfDeck: boolean } {
  const m = CATEGORIES.exec(line)
  if (!m) return { line, commander: false, outOfDeck: false }
  const categories = m[1].split(',')
  const names = categories.map((c) => c.replace(/\{[^}]*\}/g, '').trim().toLowerCase())
  return {
    line: line.slice(0, m.index),
    commander: names.includes('commander'),
    outOfDeck: categories.some((c) => /\{noDeck\}/i.test(c)) || names.some((n) => SECTION_HEADERS[n] === 'ignore'),
  }
}

export function parseDeckList(text: string): ParseResult {
  const result: ParseResult = { lines: [], ignored: 0, errors: [], tooLong: false }
  let section: Section | 'ignore' = 'main'

  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
    const lineNumber = index + 1
    const line = raw.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
    if (!line || line.startsWith('#')) return

    const header = headerOf(line)
    if (header) {
      section = header
      return
    }
    if (section === 'ignore' || SIDEBOARD_LINE.test(line)) {
      result.ignored++
      return
    }

    const categories = splitCategories(line)
    if (categories.outOfDeck) {
      result.ignored++
      return
    }
    const m = CARD_LINE.exec(categories.line)
    const quantity = m?.[1] ? Number(m[1]) : 1
    const name = m?.[2]?.trim() ?? ''
    if (!m || !name || /^\d+$/.test(name) || quantity < 1 || quantity > 99) {
      result.errors.push({ lineNumber, text: raw.trim() })
      return
    }
    result.lines.push({
      lineNumber,
      quantity,
      name,
      set: m[3] ?? null,
      number: m[4] ?? null,
      section: categories.commander ? 'commander' : section,
    })
  })

  result.tooLong = result.lines.length > MAX_CARD_LINES
  return result
}

export function lookupKey(line: { name: string; set: string | null; number: string | null }): string {
  const name = line.name.trim().replace(/\s+/g, ' ').toLowerCase()
  return `${name}|${(line.set ?? '').toLowerCase()}|${line.number ?? ''}`
}

// 20 lignes = au plus 20 cartes distinctes, soit une seule recherche Scryfall des versions françaises par paquet
// (la requête `q` de Scryfall est tronquée à 1000 caractères : 20 `oracleid:` au plus).
export const MAX_BATCH_LINES = 20

const isNullableString = (v: unknown) => v === null || typeof v === 'string'

/** Valide un paquet reçu par l'API : 1 à MAX_BATCH_LINES lignes bien formées, sinon null. */
export function validateBatch(value: unknown): ParsedLine[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_LINES) return null
  const lines: ParsedLine[] = []
  for (const item of value) {
    const l = item as Record<string, unknown>
    if (
      !l || typeof l !== 'object' ||
      !Number.isInteger(l.lineNumber) ||
      !Number.isInteger(l.quantity) || (l.quantity as number) < 1 || (l.quantity as number) > 99 ||
      typeof l.name !== 'string' || !l.name.trim() ||
      !isNullableString(l.set) || !isNullableString(l.number) ||
      (l.section !== 'main' && l.section !== 'commander')
    ) {
      return null
    }
    lines.push({
      lineNumber: l.lineNumber as number,
      quantity: l.quantity as number,
      name: l.name,
      set: l.set as string | null,
      number: l.number as string | null,
      section: l.section,
    })
  }
  return lines
}
