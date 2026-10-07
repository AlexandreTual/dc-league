import { MAX_BATCH_LINES, parseDeckList } from '@/lib/cards/parse'
import type { ImportSummary } from '@/lib/cards/types'
import { sendJson } from '@/components/formStyles'

/** Étape en cours d'un import, pour la barre de progression. */
export type ImportProgress =
  | { step: 'link' }
  | { step: 'resolving'; done: number; total: number; lines: number }
  | { step: 'committing' }

/** Résultat d'un import ; en cas d'échec Scryfall, `resumeFrom` permet de reprendre au paquet raté. */
export type ImportOutcome =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: string; text: string; resumeFrom?: number }

export type ImportDeps = {
  send?: typeof sendJson
  wait?: (ms: number) => Promise<void>
  onProgress?: (progress: ImportProgress) => void
}

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Complète la liste avec Scryfall (paquets de MAX_BATCH_LINES lignes, un nouvel essai par paquet) puis l'enregistre. */
export async function importDeckText(deckId: string, text: string, from = 0, deps: ImportDeps = {}): Promise<ImportOutcome> {
  const { send = sendJson, wait = defaultWait, onProgress } = deps
  const parsed = parseDeckList(text)
  if (parsed.tooLong) return { ok: false, error: 'La liste dépasse 250 lignes', text }
  if (parsed.lines.length === 0) return { ok: false, error: 'Aucune carte lisible dans la liste', text }

  const batches = []
  for (let i = 0; i < parsed.lines.length; i += MAX_BATCH_LINES) batches.push(parsed.lines.slice(i, i + MAX_BATCH_LINES))

  const url = `/api/decks/${deckId}/import/resolve`
  for (let i = from; i < batches.length; i++) {
    onProgress?.({ step: 'resolving', done: i, total: batches.length, lines: parsed.lines.length })
    let { error } = await send(url, 'POST', { lines: batches[i] })
    if (error) {
      await wait(2000)
      ;({ error } = await send(url, 'POST', { lines: batches[i] }))
    }
    if (error) return { ok: false, error, text, resumeFrom: i }
  }

  onProgress?.({ step: 'committing' })
  const { error, data } = await send(`/api/decks/${deckId}/import/commit`, 'POST', { text })
  if (error) return { ok: false, error, text }
  return { ok: true, summary: data as ImportSummary }
}

/** Import en un clic : lit le deck sur Moxfield ou Archidekt, puis le complète avec Scryfall et l'enregistre. */
export async function importDeckFromLink(deckId: string, link: string, deps: ImportDeps = {}): Promise<ImportOutcome> {
  const { send = sendJson, onProgress } = deps
  onProgress?.({ step: 'link' })
  const { error, data } = await send(`/api/decks/${deckId}/import/link`, 'POST', { url: link })
  if (error) return { ok: false, error, text: '' }
  return importDeckText(deckId, (data as { text: string }).text, 0, deps)
}

/** Texte court de la progression, affiché pendant l'import. */
export function progressLabel(progress: ImportProgress): string {
  if (progress.step === 'link') return 'Récupération de la liste…'
  if (progress.step === 'committing') return 'Enregistrement…'
  return `Recherche des cartes sur Scryfall… ${Math.min(progress.done * MAX_BATCH_LINES, progress.lines)}/${progress.lines}`
}
