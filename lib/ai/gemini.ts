// Client de l'API Gemini (generateContent). La clé part dans un en-tête, jamais dans l'adresse.
import { AI_TIMEOUT_MS } from './limits'
import type { GeminiContent } from './types'

/**
 * Alias de Google vers le modèle Flash courant (offre gratuite) : il suit les nouvelles versions sans
 * changer le code. GEMINI_MODEL permet d'en fixer un autre (voir docs/assistant-ia.md).
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

export type GeminiErrorKind = 'quota' | 'timeout' | 'refused' | 'unavailable'

export class GeminiError extends Error {
  constructor(readonly kind: GeminiErrorKind, detail: string) {
    super(`Gemini (${kind}) : ${detail}`)
    this.name = 'GeminiError'
  }
}

export type GeminiClient = { ask(system: string, contents: GeminiContent[]): Promise<string> }

type GeminiPart = { text?: string; thought?: boolean }
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

const REFUSED_REASONS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'OTHER'])

export function createGeminiClient(deps: {
  fetch: typeof fetch
  apiKey: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
}): GeminiClient {
  const model = deps.model || DEFAULT_GEMINI_MODEL
  const baseUrl = (deps.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`

  return {
    async ask(system, contents) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? AI_TIMEOUT_MS)
      let res: Response
      let data: GeminiResponse
      try {
        res = await deps.fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': deps.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.2 },
          }),
          signal: controller.signal,
        })
        if (res.status === 429) throw new GeminiError('quota', 'HTTP 429')
        if (!res.ok) throw new GeminiError('unavailable', `HTTP ${res.status}`)
        data = (await res.json()) as GeminiResponse
      } catch (e) {
        if (e instanceof GeminiError) throw e
        if (controller.signal.aborted) throw new GeminiError('timeout', `plus de ${deps.timeoutMs ?? AI_TIMEOUT_MS} ms`)
        throw new GeminiError('unavailable', (e as Error).message)
      } finally {
        clearTimeout(timer)
      }

      if (data.promptFeedback?.blockReason) throw new GeminiError('refused', data.promptFeedback.blockReason)
      const candidate = data.candidates?.[0]
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim()
      if (!text) throw new GeminiError('refused', candidate?.finishReason && REFUSED_REASONS.has(candidate.finishReason) ? candidate.finishReason : 'réponse vide')
      return text
    },
  }
}
