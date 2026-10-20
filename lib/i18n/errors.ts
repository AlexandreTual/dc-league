// Traduction des messages d'erreur des routes du site (pur) : les services écrivent leurs phrases en français,
// la route les traduit à la sortie dans la langue de la requête. Phrase inconnue : rendue telle quelle.
import { NextResponse } from 'next/server'
import type { Lang } from './lang'
import { fr, messages, type Messages } from './messages'

type ErrorKey = keyof Messages['errors']['messages']
type Pattern = { key: ErrorKey; re: RegExp }

const SENTINEL = (i: number) => `\u0000${i}\u0000`
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Phrases exactes (français → clé) et motifs des phrases à valeurs, tirés du dictionnaire français. */
const EXACT = new Map<string, ErrorKey>()
const PATTERNS: Pattern[] = []
for (const [key, value] of Object.entries(fr.errors.messages) as [ErrorKey, unknown][]) {
  if (typeof value === 'string') {
    EXACT.set(value, key)
  } else if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, (_, i) => SENTINEL(i))
    let source = escape((value as (...a: string[]) => string)(...args))
    args.forEach((s) => (source = source.replace(escape(s), '(.+?)')))
    PATTERNS.push({ key, re: new RegExp(`^${source}$`) })
  }
}

const LABELS = new Map(Object.entries(fr.errors.labels).map(([k, v]) => [v, k as keyof Messages['errors']['labels']]))

/** Valeur insérée : nombre rendu comme tel, nom de champ connu traduit. */
function arg(value: string, t: Messages): string | number {
  if (/^\d+$/.test(value)) return Number(value)
  const label = LABELS.get(value)
  return label ? t.errors.labels[label] : value
}

export function translateErrorWith(message: string, t: Messages): string {
  const exact = EXACT.get(message)
  if (exact) return t.errors.messages[exact] as string
  for (const { key, re } of PATTERNS) {
    const m = re.exec(message)
    if (!m) continue
    const fn = t.errors.messages[key] as (...a: (string | number)[]) => string
    return fn(...m.slice(1).map((v) => arg(v, t)))
  }
  return message
}

/** Message d'erreur dans la langue demandée ; le français ne change pas. */
export function translateError(message: string, lang: Lang): string {
  return lang === 'fr' ? message : translateErrorWith(message, messages(lang))
}

/** Réponse d'erreur JSON (`{ error }`, statut 400 et plus) traduite ; toute autre réponse rendue telle quelle. */
export async function localizeError<R extends Response>(res: R, lang: Lang): Promise<R | NextResponse> {
  if (lang === 'fr' || res.status < 400 || !res.headers.get('content-type')?.includes('application/json')) return res
  const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.error !== 'string') return res
  const error = translateError(body.error, lang)
  if (error === body.error) return res
  const headers = new Headers(res.headers)
  headers.delete('content-length')
  return new NextResponse(JSON.stringify({ ...body, error }), { status: res.status, statusText: res.statusText, headers })
}
