import type { Result } from '@/lib/db'
import { getCards, getLookups, replaceDeckCards, setDeckCommanderImage, type DeckCardInsert } from '@/lib/db-cards'
import { lookupKey, parseDeckList } from './parse'
import type { ImportSummary } from './types'

/** Réécrit le contenu d'un deck à partir du texte, en n'utilisant que le cache serveur. */
export async function commitDeckList(db: D1Database, deckId: string, text: string): Promise<Result<ImportSummary>> {
  const parsed = parseDeckList(text)
  if (parsed.lines.length === 0) return { data: null, error: 'EMPTY' }
  if (parsed.tooLong) return { data: null, error: 'TOO_LONG' }

  const lookups = await getLookups(db, parsed.lines.map(lookupKey))
  if (lookups.error !== null) return { data: null, error: lookups.error }

  const rawLines = text.replace(/\r\n?/g, '\n').split('\n')
  const summary: ImportSummary = { total: 0, commanders: 0, frenchCount: 0, notFound: [], ignored: parsed.ignored, errors: parsed.errors }
  const rows: DeckCardInsert[] = parsed.lines.map((line, index) => {
    const lookup = lookups.data[lookupKey(line)]
    const enId = lookup?.en_card_id ?? null
    const frId = enId ? lookup?.fr_card_id ?? null : null
    summary.total += line.quantity
    if (line.section === 'commander') summary.commanders += line.quantity
    if (frId) summary.frenchCount += line.quantity
    if (!enId) summary.notFound.push({ lineNumber: line.lineNumber, text: rawLines[line.lineNumber - 1].trim() })
    return {
      position: index + 1,
      quantity: line.quantity,
      section: line.section,
      requested_name: line.name,
      requested_set: line.set,
      requested_number: line.number,
      en_card_id: enId,
      fr_card_id: frId,
    }
  })

  const replaced = await replaceDeckCards(db, deckId, rows)
  if (replaced.error !== null) return { data: null, error: replaced.error }

  const commander = rows.find((r) => r.section === 'commander' && r.en_card_id)
  if (commander) {
    const cards = await getCards(db, [commander.en_card_id!, ...(commander.fr_card_id ? [commander.fr_card_id] : [])])
    if (cards.error !== null) return { data: null, error: cards.error }
    const image = cards.data[commander.fr_card_id ?? '']?.image_normal ?? cards.data[commander.en_card_id!]?.image_normal ?? null
    if (image) await setDeckCommanderImage(db, deckId, image)
  }

  return { data: summary, error: null }
}
