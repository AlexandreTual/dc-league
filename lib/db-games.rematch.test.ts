import { describe, it, expect, beforeEach } from 'vitest'
import { MIGRATIONS, createTestDb } from '@/test/d1'
import { chooseDeck, createRematch, createTable, deleteTable, finishTable, getTable, joinTable, listTables, markPlaying } from './db-games'

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  for (const [id, name] of [['p1', 'Ana'], ['p2', 'Bastien'], ['p3', 'Chloé'], ['p4', 'Damien']]) {
    await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
    await db.prepare('INSERT INTO decks (id, player_id, name) VALUES (?, ?, ?)').bind(`d-${id}`, id, `Deck de ${name}`).run()
  }
})

/** Table de 3 places (option des éliminés cochée), p1 et p2 assis avec leur deck, partie terminée. */
async function finishedGame(): Promise<string> {
  const { id } = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 3, eliminatedSeeAll: true })).data!
  await joinTable(db, id, 'p2')
  await chooseDeck(db, id, 'p1', 'd-p1')
  await chooseDeck(db, id, 'p2', 'd-p2')
  await markPlaying(db, id)
  await finishTable(db, id, 'p2')
  return id
}

describe('createRematch', () => {
  it('copie format, places et option des éliminés ; celui qui la propose est l’hôte, assis avec son deck', async () => {
    const old = await finishedGame()
    const { data: t, error } = await createRematch(db, old, 'p2')
    expect(error).toBeNull()
    expect(t).toMatchObject({ format: 'commander', seats: 3, eliminatedSeeAll: true, status: 'open', hostPlayerId: 'p2' })
    expect(t!.id).not.toBe(old)
    expect(t!.players).toEqual([{ playerId: 'p2', name: 'Bastien', deckId: 'd-p2', deckName: 'Deck de Bastien', seat: 1 }])
    expect((await getTable(db, old)).data!.rematchTableId).toBe(t!.id)
  })

  it('n’est possible que depuis une table terminée', async () => {
    const { id } = (await createTable(db, { hostPlayerId: 'p1', format: 'duel', seats: 2, eliminatedSeeAll: false })).data!
    await joinTable(db, id, 'p2')
    expect((await createRematch(db, id, 'p1')).error).toBe('La partie n’est pas terminée')
    await markPlaying(db, id)
    expect((await createRematch(db, id, 'p1')).error).toBe('La partie n’est pas terminée')
    expect((await createRematch(db, 'zzz', 'p1')).error).toBe('Table introuvable')
  })

  it('rejoindre la revanche reprend le deck de la partie précédente ; une seule revanche par partie', async () => {
    const old = await finishedGame()
    const first = (await createRematch(db, old, 'p1')).data!
    const joined = (await createRematch(db, old, 'p2')).data!
    expect(joined.id).toBe(first.id)
    expect(joined.hostPlayerId).toBe('p1')
    expect(joined.players.map((p) => [p.playerId, p.deckId, p.seat])).toEqual([['p1', 'd-p1', 1], ['p2', 'd-p2', 2]])
    // Le deck reste modifiable dans la salle d'attente.
    await db.prepare('INSERT INTO decks (id, player_id, name) VALUES (?, ?, ?)').bind('d-p2-bis', 'p2', 'Autre').run()
    expect((await chooseDeck(db, first.id, 'p2', 'd-p2-bis')).data!.players[1].deckId).toBe('d-p2-bis')
  })

  it('un joueur qui n’était pas à la table ne peut pas utiliser le raccourci', async () => {
    const old = await finishedGame()
    expect((await createRematch(db, old, 'p3')).error).toBe("Tu n'es pas à cette table")
    await createRematch(db, old, 'p1')
    expect((await createRematch(db, old, 'p3')).error).toBe("Tu n'es pas à cette table")
  })

  it('une revanche supprimée (tous partis) peut être reproposée', async () => {
    const old = await finishedGame()
    const first = (await createRematch(db, old, 'p1')).data!
    await deleteTable(db, first.id)
    const again = (await createRematch(db, old, 'p2')).data!
    expect(again.id).not.toBe(first.id)
    expect(again.hostPlayerId).toBe('p2')
  })

  it('revanche déjà commencée : refus de rejoindre', async () => {
    const old = await finishedGame()
    const first = (await createRematch(db, old, 'p1')).data!
    await markPlaying(db, first.id)
    expect((await createRematch(db, old, 'p2')).error).toBe('La partie a déjà commencé')
  })
})

describe('base pas encore migrée (site déployé avant la migration 0021)', () => {
  it('pas de revanche affichée, et une demande échoue proprement', async () => {
    db = createTestDb(MIGRATIONS.filter((m) => m !== '0021_game_rematch.sql'))
    for (const [id, name] of [['p1', 'Ana'], ['p2', 'Bastien']]) {
      await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
      await db.prepare('INSERT INTO decks (id, player_id, name) VALUES (?, ?, ?)').bind(`d-${id}`, id, `Deck de ${name}`).run()
    }
    const old = await finishedGame()
    expect((await getTable(db, old)).data!.rematchTableId).toBeNull()
    expect((await createRematch(db, old, 'p1')).error).toBe('Erreur interne, réessaie plus tard')
    expect((await listTables(db)).data).toEqual([])
  })
})
