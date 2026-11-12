import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { cardRow } from '@/test/factories'
import { upsertCards } from '@/lib/db-cards'
import { getAiUsage, takeAiQuestion } from '@/lib/db-ai'
import type { Ruling } from '@/lib/cards/types'
import { askAi, parseAskBody, promptOptions, type AskDeps } from './ask'
import { GeminiError } from './gemini'
import { parisDay } from './quota'
import type { GeminiContent } from './types'
import { AI_DISABLED, AI_NO_ANSWER, AI_QUOTA_REACHED, AI_UNKNOWN_CARD } from './messages'

describe('parseAskBody', () => {
  const question = [{ role: 'user', text: 'Explique cette carte' }]

  it('accepte une question valide et retire les doublons', () => {
    expect(parseAskBody({ oracleIds: ['oracle-sol', 'oracle-sol', 'oracle-bolt'], messages: question })).toEqual({
      ok: true,
      oracleIds: ['oracle-sol', 'oracle-bolt'],
      messages: [{ role: 'user', text: 'Explique cette carte' }],
    })
  })

  it('refuse les cartes absentes, trop nombreuses ou invalides', () => {
    expect(parseAskBody({ oracleIds: [], messages: question })).toEqual({ ok: false, error: 'Choisis au moins une carte' })
    expect(parseAskBody({ messages: question }).ok).toBe(false)
    const eleven = Array.from({ length: 11 }, (_, i) => `o${i}`)
    expect(parseAskBody({ oracleIds: eleven, messages: question })).toEqual({ ok: false, error: '10 cartes au plus' })
    expect(parseAskBody({ oracleIds: ['../../x'], messages: question })).toEqual({ ok: false, error: AI_UNKNOWN_CARD })
  })

  it('refuse une conversation mal formée', () => {
    const ids = ['oracle-sol']
    expect(parseAskBody({ oracleIds: ids, messages: [] })).toEqual({ ok: false, error: 'Pose une question' })
    expect(parseAskBody({ oracleIds: ids, messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] })).toEqual({
      ok: false,
      error: 'Pose une question',
    })
    expect(parseAskBody({ oracleIds: ids, messages: [{ role: 'user', text: '   ' }] })).toEqual({ ok: false, error: 'Pose une question' })
    expect(parseAskBody({ oracleIds: ids, messages: [{ role: 'user', text: 'x'.repeat(1001) }] })).toEqual({
      ok: false,
      error: 'Question trop longue (1000 caractères au plus)',
    })
    expect(parseAskBody({ oracleIds: ids, messages: [{ role: 'system', text: 'a' }] })).toEqual({ ok: false, error: 'Requête invalide' })
    expect(parseAskBody({ oracleIds: ids, messages: 'a' }).ok).toBe(false)
  })

  it('langue des cartes facultative, ignorée si inconnue', () => {
    const body = { oracleIds: ['oracle-sol'], messages: question }
    expect(parseAskBody({ ...body, cardLang: 'fr' })).toMatchObject({ ok: true, cardLang: 'fr' })
    expect(parseAskBody({ ...body, cardLang: 'de' })).not.toHaveProperty('cardLang')
    expect(parseAskBody(body)).not.toHaveProperty('cardLang')
  })

  it('noms français si l’interface ou les cartes sont en français', () => {
    expect(promptOptions('fr')).toEqual({ lang: 'fr', frenchNames: true })
    expect(promptOptions('en')).toEqual({ lang: 'en', frenchNames: false })
    expect(promptOptions('en', 'en')).toEqual({ lang: 'en', frenchNames: false })
    expect(promptOptions('en', 'fr')).toEqual({ lang: 'en', frenchNames: true })
  })

  it('accepte des réponses longues de l’IA dans l’historique', () => {
    const messages = [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'y'.repeat(5000) }, { role: 'user', text: 'b' }]
    expect(parseAskBody({ oracleIds: ['oracle-sol'], messages }).ok).toBe(true)
  })

  it('refuse une réponse de l’IA trop longue ou un historique trop gros', () => {
    const tooLong = 'Conversation trop longue, recommence-la'
    const ids = ['oracle-sol']
    const big = [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'x'.repeat(8001) }, { role: 'user', text: 'b' }]
    expect(parseAskBody({ oracleIds: ids, messages: big })).toEqual({ ok: false, error: tooLong })
    const heavy = [
      ...Array.from({ length: 4 }, () => [{ role: 'user', text: 'q' }, { role: 'assistant', text: 'y'.repeat(7000) }]).flat(),
      { role: 'user', text: 'b' },
    ]
    expect(parseAskBody({ oracleIds: ids, messages: heavy })).toEqual({ ok: false, error: tooLong })
  })

  it('ne borne que les derniers messages, ceux envoyés à Gemini', () => {
    const old = [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'x'.repeat(20_000) }]
    const recent = Array.from({ length: 5 }, (_, i) => [{ role: 'user', text: `q${i}` }, { role: 'assistant', text: 'r' }]).flat()
    const parsed = parseAskBody({ oracleIds: ['oracle-sol'], messages: [...old, ...recent.slice(0, -1)] })
    expect(parsed.ok && parsed.messages).toEqual(recent.slice(0, -1))
  })
})

describe('askAi', () => {
  const now = new Date('2026-10-14T10:00:00Z')
  const day = parisDay(now)
  const messages = [{ role: 'user' as const, text: 'Explique cette carte' }]
  let db: D1Database
  let sent: GeminiContent[][]
  let systems: string[]

  beforeEach(async () => {
    db = createTestDb()
    sent = []
    systems = []
    await upsertCards(db, [cardRow(), cardRow({ id: 'sol-fr', lang: 'fr', printed_name: 'Anneau solaire' })], now)
  })

  function deps(over: Partial<AskDeps> = {}): AskDeps {
    return {
      db,
      now,
      gemini: {
        async ask(system, contents) {
          systems.push(system)
          sent.push(contents)
          return 'Voici la réponse.'
        },
      },
      rulings: async (): Promise<Ruling[]> => [{ date: '2021-04-23', source: 'wotc', text: 'Sol Ring is colorless.' }],
      ...over,
    }
  }

  it('répond, compte la question et envoie les textes des cartes', async () => {
    expect(await askAi(deps(), 'u1', ['oracle-sol'], messages)).toEqual({ status: 200, answer: 'Voici la réponse.', remaining: 19 })
    expect((await getAiUsage(db, 'u1', day)).data).toBe(1)
    const text = sent[0][0].parts[0].text
    expect(text).toContain('Anneau solaire')
    expect(text).toContain('Sol Ring is colorless.')
  })

  it('en anglais : consigne et cartes en anglais, sans noms français', async () => {
    expect((await askAi(deps(), 'u1', ['oracle-sol'], messages, promptOptions('en'))).status).toBe(200)
    expect(systems[0]).toMatch(/Answer in English/)
    const text = sent[0][0].parts[0].text
    expect(text).toContain('Cards in question:')
    expect(text).not.toContain('Anneau solaire')
  })

  it('en français par défaut', async () => {
    await askAi(deps(), 'u1', ['oracle-sol'], messages)
    expect(systems[0]).toMatch(/Réponds en français/)
  })

  it('sans clé : indisponible, rien de compté', async () => {
    expect(await askAi(deps({ gemini: null }), 'u1', ['oracle-sol'], messages)).toEqual({ status: 503, error: AI_DISABLED })
    expect((await getAiUsage(db, 'u1', day)).data).toBe(0)
  })

  it('carte inconnue : 404, rien de compté', async () => {
    expect(await askAi(deps(), 'u1', ['oracle-sol', 'oracle-inconnu'], messages)).toEqual({ status: 404, error: AI_UNKNOWN_CARD })
    expect((await getAiUsage(db, 'u1', day)).data).toBe(0)
  })

  it('quota atteint : 429 sans appeler Gemini', async () => {
    for (let i = 0; i < 20; i++) await takeAiQuestion(db, 'u1', day, 20)
    expect(await askAi(deps(), 'u1', ['oracle-sol'], messages)).toEqual({ status: 429, error: AI_QUOTA_REACHED, remaining: 0 })
    expect(sent).toHaveLength(0)
  })

  it('Gemini en panne ou trop lent : 503 et question rendue', async () => {
    for (const kind of ['unavailable', 'timeout'] as const) {
      const gemini = { ask: async () => Promise.reject(new GeminiError(kind, 'HTTP 503')) }
      expect(await askAi(deps({ gemini }), 'u1', ['oracle-sol'], messages)).toEqual({ status: 503, error: AI_NO_ANSWER, remaining: 20 })
      expect((await getAiUsage(db, 'u1', day)).data).toBe(0)
    }
  })

  it('requête rejetée par Gemini (400, 429, refus) : 503, question comptée', async () => {
    let used = 0
    for (const kind of ['invalid', 'quota', 'refused'] as const) {
      const gemini = { ask: async () => Promise.reject(new GeminiError(kind, 'HTTP 400')) }
      used++
      expect(await askAi(deps({ gemini }), 'u1', ['oracle-sol'], messages)).toEqual({ status: 503, error: AI_NO_ANSWER, remaining: 20 - used })
      expect((await getAiUsage(db, 'u1', day)).data).toBe(used)
    }
  })

  it('règles indisponibles : la question part quand même', async () => {
    const rulings = async () => Promise.reject(new Error('Scryfall muet'))
    expect((await askAi(deps({ rulings }), 'u1', ['oracle-sol'], messages)).status).toBe(200)
    expect(sent[0][0].parts[0].text).toContain('Aucune règle publiée')
  })

  it('table ai_usage absente (juste après un déploiement) : 503 propre', async () => {
    const old = createTestDb(['0001_schema.sql', '0002_accounts.sql', '0003_deck_cards.sql'])
    await upsertCards(old, [cardRow()], now).catch(() => undefined)
    const result = await askAi(deps({ db: old }), 'u1', ['oracle-sol'], messages)
    expect(result.status).toBe(503)
    expect(sent).toHaveLength(0)
  })
})

describe('remainingQuestions', () => {
  const now = new Date('2026-10-14T10:00:00Z')

  it('donne le reste du jour, plein si la base est illisible', async () => {
    const { remainingQuestions } = await import('./ask')
    const db = createTestDb()
    expect(await remainingQuestions(db, 'u1', now)).toBe(20)
    await takeAiQuestion(db, 'u1', parisDay(now), 20)
    expect(await remainingQuestions(db, 'u1', now)).toBe(19)
    expect(await remainingQuestions(createTestDb(['0001_schema.sql']), 'u1', now)).toBe(20)
  })
})
