import { describe, it, expect } from 'vitest'
import { ScryfallUnavailableError } from '@/lib/cards/scryfall'
import { customToken, searchTokens } from './tokens'

function fakeFetch(status: number, body: unknown) {
  const urls: string[] = []
  const fn = (async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { fn, urls }
}

const soldier = {
  object: 'card', id: 't1', name: 'Soldier', type_line: 'Token Creature — Soldier', power: '1', toughness: '1',
  colors: ['W'], image_uris: { small: 'https://img/s.jpg', normal: 'https://img/n.jpg' },
}
const treasure = { object: 'card', id: 't2', name: 'Treasure', type_line: 'Token Artifact — Treasure', colors: [], image_uris: { small: 'https://img/t.jpg' } }

describe('searchTokens', () => {
  it('interroge Scryfall et convertit les jetons', async () => {
    const f = fakeFetch(200, { object: 'list', data: [soldier, treasure] })
    const tokens = await searchTokens(f.fn, 'soldier')
    const url = new URL(f.urls[0])
    expect(url.origin + url.pathname).toBe('https://api.scryfall.com/cards/search')
    expect(url.searchParams.get('q')).toBe('t:token soldier')
    expect(url.searchParams.get('unique')).toBe('cards')
    expect(tokens).toEqual([
      { name: 'Soldier', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: ['W'], image: 'https://img/n.jpg' },
      { name: 'Treasure', typeLine: 'Token Artifact — Treasure', power: null, toughness: null, colors: [], image: 'https://img/t.jpg' },
    ])
  })

  it('renvoie [] sur un 404', async () => {
    expect(await searchTokens(fakeFetch(404, { object: 'error' }).fn, 'zzz')).toEqual([])
  })

  it('lève ScryfallUnavailableError sur une autre erreur', async () => {
    await expect(searchTokens(fakeFetch(500, {}).fn, 'x')).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })

  it('lève ScryfallUnavailableError sur une erreur réseau', async () => {
    const f = (async () => { throw new TypeError('fetch failed') }) as typeof fetch
    await expect(searchTokens(f, 'x')).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })
})

describe('customToken', () => {
  it('crée un jeton créature', () => {
    expect(customToken({ name: 'Soldat', power: '1', toughness: '1', colors: ['W'] })).toEqual({
      name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: ['W'], image: null,
    })
  })

  it('crée un jeton non créature sans force ni endurance', () => {
    expect(customToken({ name: 'Trésor', power: '', toughness: '', colors: [] })).toMatchObject({
      typeLine: 'Token — Trésor', power: null, toughness: null,
    })
  })
})
