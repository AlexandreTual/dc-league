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

// quantité optionnelle, nom, puis éventuellement "(SET) numéro", puis des marques *F* ignorées
const CARD_LINE = /^(?:(\d+)x?\s+)?(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+(\S+))?((?:\s+\*[A-Za-z]+\*)*)$/

function headerOf(line: string): Section | 'ignore' | null {
  const word = line.replace(/^\/\/\s*/, '').replace(/:$/, '').trim().toLowerCase()
  return SECTION_HEADERS[word] ?? null
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
    if (section === 'ignore') {
      result.ignored++
      return
    }

    const m = CARD_LINE.exec(line)
    const quantity = m?.[1] ? Number(m[1]) : 1
    const name = m?.[2]?.trim() ?? ''
    if (!m || !name || /^\d+$/.test(name) || quantity < 1 || quantity > 99) {
      result.errors.push({ lineNumber, text: raw.trim() })
      return
    }
    result.lines.push({ lineNumber, quantity, name, set: m[3] ?? null, number: m[4] ?? null, section })
  })

  result.tooLong = result.lines.length > MAX_CARD_LINES
  return result
}

export function lookupKey(line: { name: string; set: string | null; number: string | null }): string {
  const name = line.name.trim().replace(/\s+/g, ' ').toLowerCase()
  return `${name}|${(line.set ?? '').toLowerCase()}|${line.number ?? ''}`
}

export const MAX_BATCH_LINES = 25

const isNullableString = (v: unknown) => v === null || typeof v === 'string'

/** Valide un paquet reçu par l'API : 1 à 25 lignes bien formées, sinon null. */
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
