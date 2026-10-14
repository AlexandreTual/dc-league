// Une question à l'assistant IA : validation, cartes, quota, règles, Gemini (dépendances injectées).
import { getCardsByOracle } from '@/lib/db-cards'
import { getAiUsage, giveBackAiQuestion, takeAiQuestion } from '@/lib/db-ai'
import { isOracleId } from '@/lib/cards/rulings'
import type { Ruling } from '@/lib/cards/types'
import type { GeminiClient } from './gemini'
import { AI_DAILY_QUOTA, AI_MAX_CARDS, AI_MAX_QUESTION_CHARS } from './limits'
import { AI_DISABLED, AI_NO_ANSWER, AI_QUOTA_REACHED, AI_UNKNOWN_CARD } from './messages'
import { buildContents, SYSTEM_INSTRUCTION } from './prompt'
import { parisDay } from './quota'
import type { AiCard, ChatMessage } from './types'

export type AskDeps = {
  db: D1Database
  /** null quand GEMINI_API_KEY est absente : fonction désactivée. */
  gemini: GeminiClient | null
  rulings: (oracleId: string) => Promise<Ruling[]>
  now: Date
}

export type AskResult =
  | { status: 200; answer: string; remaining: number }
  | { status: 400 | 404 | 429 | 503; error: string; remaining?: number }

type Parsed = { ok: true; oracleIds: string[]; messages: ChatMessage[] } | { ok: false; error: string }

/** Corps de POST /api/ai/ask : { oracleIds, messages }, le dernier message étant la nouvelle question. */
export function parseAskBody(body: Record<string, unknown>): Parsed {
  const ids = body.oracleIds
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Choisis au moins une carte' }
  if (!ids.every((id) => typeof id === 'string' && isOracleId(id))) return { ok: false, error: AI_UNKNOWN_CARD }
  const oracleIds = [...new Set(ids as string[])]
  if (oracleIds.length > AI_MAX_CARDS) return { ok: false, error: `${AI_MAX_CARDS} cartes au plus` }

  const raw = body.messages
  if (!Array.isArray(raw)) return { ok: false, error: 'Requête invalide' }
  const messages: ChatMessage[] = []
  for (const m of raw) {
    const { role, text } = (m ?? {}) as { role?: unknown; text?: unknown }
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string') return { ok: false, error: 'Requête invalide' }
    messages.push({ role, text })
  }
  const question = messages[messages.length - 1]
  if (!question || question.role !== 'user' || !question.text.trim()) return { ok: false, error: 'Pose une question' }
  if (messages.some((m) => m.role === 'user' && m.text.length > AI_MAX_QUESTION_CHARS)) {
    return { ok: false, error: `Question trop longue (${AI_MAX_QUESTION_CHARS} caractères au plus)` }
  }
  return { ok: true, oracleIds, messages }
}

export async function askAi(deps: AskDeps, userId: string, oracleIds: string[], messages: ChatMessage[]): Promise<AskResult> {
  if (!deps.gemini) return { status: 503, error: AI_DISABLED }

  const found = await getCardsByOracle(deps.db, oracleIds)
  if (found.error !== null) return { status: 503, error: AI_NO_ANSWER }
  if (oracleIds.some((id) => !found.data[id])) return { status: 404, error: AI_UNKNOWN_CARD }

  const day = parisDay(deps.now)
  const taken = await takeAiQuestion(deps.db, userId, day, AI_DAILY_QUOTA)
  // Table pas encore créée (site déployé avant la migration) : erreur propre, rien de compté.
  if (taken.error !== null) return { status: 503, error: AI_NO_ANSWER }
  if (taken.data === null) return { status: 429, error: AI_QUOTA_REACHED, remaining: 0 }

  const cards: AiCard[] = await Promise.all(
    oracleIds.map(async (id) => ({ ...found.data[id], rulings: await deps.rulings(id).catch(() => []) })),
  )
  try {
    const answer = await deps.gemini.ask(SYSTEM_INSTRUCTION, buildContents(cards, messages))
    return { status: 200, answer, remaining: taken.data }
  } catch (e) {
    console.error('[ia]', (e as Error).message)
    await giveBackAiQuestion(deps.db, userId, day)
    return { status: 503, error: AI_NO_ANSWER, remaining: taken.data + 1 }
  }
}

/** Questions restantes aujourd'hui (base illisible : on affiche le quota plein, la route d'envoi tranchera). */
export async function remainingQuestions(db: D1Database, userId: string, now: Date): Promise<number> {
  const used = await getAiUsage(db, userId, parisDay(now))
  return used.error !== null ? AI_DAILY_QUOTA : Math.max(0, AI_DAILY_QUOTA - used.data)
}
