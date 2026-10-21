import { describe, it, expect } from 'vitest'
import { createGeminiClient, DEFAULT_GEMINI_MODEL, GeminiError } from './gemini'

type Call = { url: string; init: RequestInit }

function fakeFetch(reply: (call: Call) => Promise<Response> | Response) {
  const calls: Call[] = []
  const fetch = (async (url: string, init: RequestInit) => {
    const call = { url: String(url), init }
    calls.push(call)
    return reply(call)
  }) as unknown as typeof globalThis.fetch
  return { calls, fetch }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const answer = (...texts: string[]) => json(200, { candidates: [{ content: { role: 'model', parts: texts.map((text) => ({ text })) }, finishReason: 'STOP' }] })
const contents = [{ role: 'user' as const, parts: [{ text: 'Question' }] }]

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return 'aucune erreur'
  } catch (e) {
    return e instanceof GeminiError ? e.kind : `autre : ${(e as Error).message}`
  }
}

describe('client Gemini', () => {
  it('appelle generateContent avec la clé dans un en-tête, jamais dans l’adresse', async () => {
    const { calls, fetch } = fakeFetch(() => answer('Réponse'))
    const client = createGeminiClient({ fetch, apiKey: 'cle-secrete' })
    expect(await client.ask('Consigne', contents)).toBe('Réponse')

    const [call] = calls
    expect(call.url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`)
    expect(call.url).not.toContain('cle-secrete')
    expect(call.init.method).toBe('POST')
    expect(new Headers(call.init.headers).get('x-goog-api-key')).toBe('cle-secrete')
    const body = JSON.parse(String(call.init.body))
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Consigne' }] })
    expect(body.contents).toEqual(contents)
    expect(body.generationConfig).toBeDefined()
  })

  it('prend le modèle et l’adresse fournis', async () => {
    const { calls, fetch } = fakeFetch(() => answer('ok'))
    await createGeminiClient({ fetch, apiKey: 'k', model: 'gemini-test', baseUrl: 'http://localhost:8790/' }).ask('s', contents)
    expect(calls[0].url).toBe('http://localhost:8790/v1beta/models/gemini-test:generateContent')
  })

  it('assemble les morceaux de texte et ignore les « pensées »', async () => {
    const { fetch } = fakeFetch(() =>
      json(200, { candidates: [{ content: { parts: [{ text: 'brouillon', thought: true }, { text: 'Première ' }, { text: 'partie.' }] } }] }),
    )
    expect(await createGeminiClient({ fetch, apiKey: 'k' }).ask('s', contents)).toBe('Première partie.')
  })

  it('traduit les erreurs', async () => {
    const ask = (reply: () => Promise<Response> | Response, timeoutMs?: number) =>
      createGeminiClient({ fetch: fakeFetch(reply).fetch, apiKey: 'k', timeoutMs }).ask('s', contents)

    expect(await kindOf(ask(() => json(429, { error: { status: 'RESOURCE_EXHAUSTED' } })))).toBe('quota')
    expect(await kindOf(ask(() => json(503, {})))).toBe('unavailable')
    expect(await kindOf(ask(() => json(400, { error: { message: 'API key not valid' } })))).toBe('invalid')
    expect(await kindOf(ask(() => json(500, {})))).toBe('unavailable')
    expect(await kindOf(ask(() => Promise.reject(new TypeError('réseau'))))).toBe('unavailable')
    expect(await kindOf(ask(() => json(200, { promptFeedback: { blockReason: 'SAFETY' } })))).toBe('refused')
    expect(await kindOf(ask(() => json(200, { candidates: [{ finishReason: 'SAFETY' }] })))).toBe('refused')
    expect(await kindOf(ask(() => answer('   ')))).toBe('refused')
    expect(await kindOf(ask(() => new Response('pas du json', { status: 200 })))).toBe('unavailable')
  })

  it('abandonne après le délai', async () => {
    const { fetch } = fakeFetch(
      (call) =>
        new Promise((_, reject) => {
          call.init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    expect(await kindOf(createGeminiClient({ fetch, apiKey: 'k', timeoutMs: 20 }).ask('s', contents))).toBe('timeout')
  })
})
