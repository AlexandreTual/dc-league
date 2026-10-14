// Dépendances réelles de l'assistant IA pour les routes (Gemini, règles via Scryfall, interrupteur admin).
import { createScryfallClient } from '@/lib/cards/scryfall'
import { loadRulings } from '@/lib/cards/rulings'
import type { Ruling } from '@/lib/cards/types'
import type { AskDeps } from './ask'
import { createGeminiClient } from './gemini'
import { isAiSwitchedOn } from './switch'

/** Assistant disponible : clé Gemini présente et interrupteur de l'administration activé. */
export async function aiAvailable(env: CloudflareEnv): Promise<boolean> {
  return Boolean(env.GEMINI_API_KEY) && (await isAiSwitchedOn(env.DB))
}

export async function askDeps(env: CloudflareEnv, now: Date): Promise<AskDeps> {
  const scryfall = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
  return {
    db: env.DB,
    now,
    gemini:
      env.GEMINI_API_KEY && (await aiAvailable(env))
        ? createGeminiClient({ fetch, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, baseUrl: env.GEMINI_BASE_URL })
        : null,
    rulings: async (oracleId): Promise<Ruling[]> => {
      const result = await loadRulings(env.DB, scryfall, oracleId, now)
      return result.status === 'ok' ? result.rulings : []
    },
  }
}
