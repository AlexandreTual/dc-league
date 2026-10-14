import { describe, expect, it } from 'vitest'
import { importDeckFromLink, importDeckText, progressLabel, type ImportProgress } from './importDeck'

const summary = { total: 32, commanders: 1, frenchCount: 30, notFound: [], ignored: 0, errors: [] }
const text = ['Commander', '1 Kenrith, the Returned King (eld) 303', '', 'Deck', '1 Sol Ring (c21) 263', '30 Forest (eld) 266'].join('\n')

/** Faux `sendJson` : répond selon la fin de l'URL et garde la trace des appels. */
function fakeSend(answers: Record<string, Array<{ error: string | null; data?: unknown }>>) {
  const calls: Array<{ url: string; body: unknown }> = []
  const send = async (url: string, _method: string, body?: unknown) => {
    calls.push({ url, body })
    const key = Object.keys(answers).find((k) => url.endsWith(k))!
    const answer = answers[key].length > 1 ? answers[key].shift()! : answers[key][0]
    return { error: answer.error, data: answer.data ?? {} }
  }
  return { send, calls }
}

const noWait = async () => {}

describe('importDeckFromLink', () => {
  it('récupère la liste, la complète avec Scryfall et l’enregistre, sans autre étape', async () => {
    const { send, calls } = fakeSend({
      '/import/link': [{ error: null, data: { text, name: 'Kenrith' } }],
      '/import/resolve': [{ error: null }],
      '/import/commit': [{ error: null, data: summary }],
    })
    const steps: ImportProgress['step'][] = []
    const outcome = await importDeckFromLink('d1', 'https://moxfield.com/decks/abc', { send, wait: noWait, onProgress: (p) => steps.push(p.step) })

    expect(outcome).toEqual({ ok: true, summary })
    expect(calls.map((c) => c.url)).toEqual(['/api/decks/d1/import/link', '/api/decks/d1/import/resolve', '/api/decks/d1/import/commit'])
    expect(calls[0].body).toEqual({ url: 'https://moxfield.com/decks/abc' })
    expect(calls[2].body).toEqual({ text })
    expect(steps).toEqual(['link', 'resolving', 'committing'])
  })

  it('s’arrête sur l’erreur du lien, sans appeler Scryfall', async () => {
    const { send, calls } = fakeSend({ '/import/link': [{ error: 'Lien non reconnu (Moxfield ou Archidekt)' }] })
    const outcome = await importDeckFromLink('d1', 'https://example.com', { send, wait: noWait })
    expect(outcome).toEqual({ ok: false, error: 'Lien non reconnu (Moxfield ou Archidekt)', text: '' })
    expect(calls).toHaveLength(1)
  })
})

describe('importDeckText', () => {
  it('découpe en paquets de 20 lignes', async () => {
    const long = Array.from({ length: 45 }, (_, i) => `1 Carte ${i}`).join('\n')
    const { send, calls } = fakeSend({ '/import/resolve': [{ error: null }], '/import/commit': [{ error: null, data: summary }] })
    await importDeckText('d1', long, 0, { send, wait: noWait })
    expect(calls.filter((c) => c.url.endsWith('/resolve')).map((c) => (c.body as { lines: unknown[] }).lines.length)).toEqual([20, 20, 5])
  })

  it('réessaie une fois un paquet, puis rend la main avec le paquet à reprendre', async () => {
    const { send } = fakeSend({ '/import/resolve': [{ error: 'Scryfall injoignable' }] })
    const outcome = await importDeckText('d1', text, 0, { send, wait: noWait })
    expect(outcome).toEqual({ ok: false, error: 'Scryfall injoignable', text, resumeFrom: 0 })
  })

  it('refuse une liste sans carte lisible', async () => {
    const { send, calls } = fakeSend({})
    expect(await importDeckText('d1', 'Deck\n\n', 0, { send })).toMatchObject({ ok: false, error: 'Aucune carte lisible dans la liste' })
    expect(calls).toHaveLength(0)
  })
})

describe('progressLabel', () => {
  it('décrit chaque étape en français', () => {
    expect(progressLabel({ step: 'link' })).toBe('Récupération de la liste…')
    expect(progressLabel({ step: 'resolving', done: 1, total: 3, lines: 45 })).toBe('Recherche des cartes sur Scryfall… 20/45')
    expect(progressLabel({ step: 'committing' })).toBe('Enregistrement…')
  })
})
