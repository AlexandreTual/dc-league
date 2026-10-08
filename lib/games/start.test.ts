import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { cardRow, seedCache } from '@/test/factories'
import { commitDeckList } from '@/lib/cards/commit'
import { lookupKey, parseDeckList } from '@/lib/cards/parse'
import { createScryfallClient } from '@/lib/cards/scryfall'
import { chooseDeck, createTable, getTable, joinTable } from '@/lib/db-games'
import type { GameSetup } from '@/lib/game/types'
import { startTable, type GameInit } from './start'

// Scryfall factice : aucune carte, donc aucun jeton.
const noTokens = createScryfallClient({ fetch: (async () => new Response('{"data":[]}')) as unknown as typeof fetch, sleep: async () => {} })

let db: D1Database
let tableId: string
let calls: { tableId: string; body: { setup: GameSetup; hostId: string; firstPlayer?: string } }[]

const okInit: GameInit = async (id, body) => {
  calls.push({ tableId: id, body })
  return { ok: true, status: 201 }
}

beforeEach(async () => {
  db = createTestDb()
  calls = []
  const list = '1 Sol Ring\n2 Forest'
  await seedCache(db, parseDeckList(list).lines.map((l, i) => ({ key: lookupKey(l), en: cardRow({ id: `en-${i}`, name: l.name }) })))
  for (const [id, name] of [['p1', 'Alex'], ['p2', 'Bob']]) {
    await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
    await db.prepare('INSERT INTO decks (id, player_id, name) VALUES (?, ?, ?)').bind(`d-${id}`, id, `Deck de ${name}`).run()
    await commitDeckList(db, `d-${id}`, list, noTokens)
  }
  tableId = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 3, eliminatedSeeAll: true })).data!.id
  await joinTable(db, tableId, 'p2')
  await chooseDeck(db, tableId, 'p1', 'd-p1')
  await chooseDeck(db, tableId, 'p2', 'd-p2')
})

describe('startTable', () => {
  it('réservé à l’hôte', async () => {
    expect((await startTable(db, okInit, tableId, 'p2')).error).toBe("Seul l'hôte peut faire ça")
    expect(calls).toEqual([])
  })

  it('refuse si un deck choisi a été supprimé', async () => {
    await db.prepare("DELETE FROM decks WHERE id = 'd-p2'").run()
    expect((await startTable(db, okInit, tableId, 'p1')).error).toBe('Chaque joueur doit choisir un deck')
    expect(calls).toEqual([])
  })

  it('construit la partie et passe la table en cours', async () => {
    const res = await startTable(db, okInit, tableId, 'p1')
    expect(res.data?.status).toBe('playing')
    expect(calls).toHaveLength(1)
    const { setup, hostId } = calls[0].body
    expect(calls[0].tableId).toBe(tableId)
    expect(hostId).toBe('p1')
    expect(setup).toMatchObject({ format: 'commander', options: { eliminatedSeeAll: true } })
    expect(setup.players.map((p) => [p.id, p.name, p.catalog.deckId])).toEqual([['p1', 'Alex', 'd-p1'], ['p2', 'Bob', 'd-p2']])
    expect(setup.players[0].catalog.entries.map((e) => [e.en.name, e.quantity])).toEqual([['Sol Ring', 1], ['Forest', 2]])
  })

  it('force et endurance des cartes importées avant leur ajout : relues chez Scryfall pour la partie', async () => {
    const stats = createScryfallClient({
      fetch: (async () => new Response(JSON.stringify({ data: [{ id: 'en-1', lang: 'en', name: 'Forest', set: 'tst', collector_number: '1' }] }))) as unknown as typeof fetch,
      sleep: async () => {},
    })
    await db.prepare("UPDATE cards SET power = NULL, toughness = NULL WHERE id = 'en-1'").run()
    await startTable(db, okInit, tableId, 'p1', undefined, stats)
    const forest = calls[0].body.setup.players[0].catalog.entries.find((e) => e.en.id === 'en-1')!
    expect([forest.en.power, forest.en.toughness]).toEqual([null, null])
  })

  it('premier joueur choisi par l’hôte : transmis au serveur de jeu', async () => {
    await startTable(db, okInit, tableId, 'p1', 'p2')
    expect(calls[0].body.firstPlayer).toBe('p2')
  })

  it('sans choix de premier joueur : rien n’est transmis (tirage au sort)', async () => {
    await startTable(db, okInit, tableId, 'p1')
    expect(calls[0].body).not.toHaveProperty('firstPlayer')
  })

  it('refuse un premier joueur qui n’est pas à la table', async () => {
    expect((await startTable(db, okInit, tableId, 'p1', 'p9')).error).toBe("Ce joueur n'est pas à cette table")
    expect(calls).toEqual([])
    expect((await getTable(db, tableId)).data!.status).toBe('open')
  })

  it('table qui reste ouverte si le serveur de jeu échoue', async () => {
    const res = await startTable(db, async () => ({ ok: false, status: 500 }), tableId, 'p1')
    expect(res.error).toBe('Erreur interne, réessaie plus tard')
    expect((await getTable(db, tableId)).data!.status).toBe('open')
  })

  it('table rouverte si le serveur de jeu est injoignable (exception)', async () => {
    const throwing: GameInit = async () => { throw new Error('injoignable') }
    await expect(startTable(db, throwing, tableId, 'p1')).rejects.toThrow('injoignable')
    expect((await getTable(db, tableId)).data!.status).toBe('open')
  })
})

describe('startTable concurrent', () => {
  it('deux démarrages simultanés : une seule partie créée', async () => {
    const results = await Promise.all([startTable(db, okInit, tableId, 'p1'), startTable(db, okInit, tableId, 'p1')])
    expect(results.filter((r) => r.data?.status === 'playing')).toHaveLength(1)
    expect(results.filter((r) => r.error === 'La partie a déjà commencé')).toHaveLength(1)
    expect(calls).toHaveLength(1)
  })

  it('pendant la création, personne ne rejoint : la partie a les joueurs réservés', async () => {
    await db.prepare("INSERT INTO players (id, name) VALUES ('p3', 'Chloé')").run()
    let joined: string | null = 'pas tenté'
    const slowInit: GameInit = async (id, body) => {
      joined = (await joinTable(db, tableId, 'p3')).error
      return okInit(id, body)
    }
    const res = await startTable(db, slowInit, tableId, 'p1')
    expect(joined).toBe('La partie a déjà commencé')
    expect(res.data!.players.map((p) => p.playerId)).toEqual(['p1', 'p2'])
    expect(calls[0].body.setup.players.map((p) => p.id)).toEqual(['p1', 'p2'])
  })
})
