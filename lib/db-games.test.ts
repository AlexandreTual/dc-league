import { describe, it, expect, beforeEach } from 'vitest'
import { MIGRATIONS, createTestDb, readMigration } from '@/test/d1'
import {
  chooseDeck, claimStart, createTable, deleteTable, finishTable, getTable, joinTable, leaveTable, listTables, markPlaying,
  playingTables, releaseStart, removeSeat, setHost, staleTables, startCheck, touchActivity,
} from './db-games'

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  for (const [id, name] of [['p1', 'Alex'], ['p2', 'Bob'], ['p3', 'Chloé'], ['p4', 'Dan']]) {
    await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
    await db.prepare('INSERT INTO decks (id, player_id, name) VALUES (?, ?, ?)').bind(`d-${id}`, id, `Deck de ${name}`).run()
  }
})

const commander = (seats = 4) => createTable(db, { hostPlayerId: 'p1', format: 'commander', seats, eliminatedSeeAll: false })

describe('createTable', () => {
  it('l’hôte occupe la place 1', async () => {
    const t = (await commander()).data!
    expect(t).toMatchObject({ hostPlayerId: 'p1', format: 'commander', seats: 4, status: 'open', eliminatedSeeAll: false, winnerPlayerId: null })
    expect(t.players).toEqual([{ playerId: 'p1', name: 'Alex', deckId: null, deckName: null, seat: 1 }])
  })

  it('force 2 places en Duel', async () => {
    const t = (await createTable(db, { hostPlayerId: 'p1', format: 'duel', seats: 4, eliminatedSeeAll: true })).data!
    expect(t.seats).toBe(2)
    expect(t.eliminatedSeeAll).toBe(true)
  })
})

describe('joinTable', () => {
  it('donne la place suivante, sans doublon', async () => {
    const { id } = (await commander()).data!
    await joinTable(db, id, 'p2')
    const t = (await joinTable(db, id, 'p2')).data!
    expect(t.players.map((p) => [p.playerId, p.seat])).toEqual([['p1', 1], ['p2', 2]])
  })

  it('refuse une table complète, commencée ou inconnue', async () => {
    const { id } = (await commander(2)).data!
    await joinTable(db, id, 'p2')
    expect((await joinTable(db, id, 'p3')).error).toBe('Table complète')
    await markPlaying(db, id)
    expect((await joinTable(db, id, 'p3')).error).toBe('La partie a déjà commencé')
    expect((await joinTable(db, 'zzz', 'p3')).error).toBe('Table introuvable')
  })
})

describe('joinTable concurrents', () => {
  it('jamais plus de joueurs que de places, même en simultané', async () => {
    const { id } = (await commander(3)).data!
    const results = await Promise.all(['p2', 'p3', 'p4'].map((p) => joinTable(db, id, p)))
    expect(results.filter((r) => r.error === null)).toHaveLength(2)
    expect(results.filter((r) => r.error === 'Table complète')).toHaveLength(1)
    expect((await getTable(db, id)).data!.players.map((p) => p.seat)).toEqual([1, 2, 3])
  })
})

describe('réservation du démarrage', () => {
  it('une seule réservation, par l’hôte ; ensuite plus de changement de places ni de deck', async () => {
    const { id } = (await commander()).data!
    await joinTable(db, id, 'p2')
    await joinTable(db, id, 'p3')
    expect((await claimStart(db, id, 'p2')).data).toBe(false)
    const claims = await Promise.all([claimStart(db, id, 'p1'), claimStart(db, id, 'p1')])
    expect(claims.map((c) => c.data).sort()).toEqual([false, true])
    expect((await getTable(db, id)).data!.status).toBe('starting')

    expect((await joinTable(db, id, 'p4')).error).toBe('La partie a déjà commencé')
    expect((await leaveTable(db, id, 'p2')).error).toBe('La partie a déjà commencé')
    expect((await chooseDeck(db, id, 'p2', 'd-p2')).error).toBe('La partie a déjà commencé')
    expect((await removeSeat(db, id, 'p1', 'p3')).error).toBe('La partie a déjà commencé')
    expect((await getTable(db, id)).data!.players.map((p) => [p.playerId, p.deckId])).toEqual([['p1', null], ['p2', null], ['p3', null]])

    await releaseStart(db, id)
    expect((await getTable(db, id)).data!.status).toBe('open')
    expect((await joinTable(db, id, 'p4')).error).toBeNull()
  })

  it('migration 0006 : places conservées, statut starting accepté', async () => {
    const old = createTestDb(MIGRATIONS.filter((f) => f < '0006'))
    await old.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob')").run()
    await old.prepare("INSERT INTO game_tables (id, host_player_id, format, seats) VALUES ('t', 'p1', 'commander', 4)").run()
    await old.prepare("INSERT INTO game_seats (table_id, player_id, seat) VALUES ('t', 'p1', 1), ('t', 'p2', 2)").run()
    await old.exec(readMigration('0006_table_starting.sql'))
    expect((await getTable(old, 't')).data!.players.map((p) => p.playerId)).toEqual(['p1', 'p2'])
    expect((await claimStart(old, 't', 'p1')).data).toBe(true)
    await deleteTable(old, 't')
    const seats = await old.prepare('SELECT COUNT(*) AS n FROM game_seats').first<{ n: number }>()
    expect(seats!.n).toBe(0)
  })
})

describe('leaveTable et removeSeat', () => {
  it('l’hôte qui part passe la main au joueur suivant ; le dernier qui part supprime la table', async () => {
    const { id } = (await commander()).data!
    await joinTable(db, id, 'p2')
    const t = (await leaveTable(db, id, 'p1')).data!
    expect(t.hostPlayerId).toBe('p2')
    expect(t.players.map((p) => p.playerId)).toEqual(['p2'])
    await leaveTable(db, id, 'p2')
    expect((await getTable(db, id)).data).toBeNull()
  })

  it('refuse de partir d’une partie commencée', async () => {
    const { id } = (await commander()).data!
    await joinTable(db, id, 'p2')
    await markPlaying(db, id)
    expect((await leaveTable(db, id, 'p2')).error).toBe('La partie a déjà commencé')
  })

  it('seul l’hôte retire un joueur', async () => {
    const { id } = (await commander()).data!
    await joinTable(db, id, 'p2')
    await joinTable(db, id, 'p3')
    expect((await removeSeat(db, id, 'p2', 'p3')).error).toBe("Seul l'hôte peut faire ça")
    const t = (await removeSeat(db, id, 'p1', 'p3')).data!
    expect(t.players.map((p) => p.playerId)).toEqual(['p1', 'p2'])
  })
})

describe('chooseDeck et startCheck', () => {
  it('choisit son deck, pas celui d’un autre', async () => {
    const { id } = (await commander()).data!
    expect((await chooseDeck(db, id, 'p1', 'd-p2')).error).toBe("Ce deck n'est pas à toi")
    expect((await chooseDeck(db, id, 'p2', 'd-p2')).error).toBe("Tu n'es pas à cette table")
    const t = (await chooseDeck(db, id, 'p1', 'd-p1')).data!
    expect(t.players[0]).toMatchObject({ deckId: 'd-p1', deckName: 'Deck de Alex' })
  })

  it('conditions de départ', async () => {
    const { id } = (await commander()).data!
    await chooseDeck(db, id, 'p1', 'd-p1')
    expect(startCheck((await getTable(db, id)).data!)).toBe('Il faut au moins 2 joueurs')
    await joinTable(db, id, 'p2')
    expect(startCheck((await getTable(db, id)).data!)).toBe('Chaque joueur doit choisir un deck')
    await chooseDeck(db, id, 'p2', 'd-p2')
    expect(startCheck((await getTable(db, id)).data!)).toBeNull()

    await db.prepare("DELETE FROM decks WHERE id = 'd-p2'").run()
    expect(startCheck((await getTable(db, id)).data!)).toBe('Chaque joueur doit choisir un deck')

    await markPlaying(db, id)
    expect(startCheck((await getTable(db, id)).data!)).toBe('La partie a déjà commencé')
  })

  it('Duel : exactement 2 joueurs', async () => {
    const { id } = (await createTable(db, { hostPlayerId: 'p1', format: 'duel', seats: 2, eliminatedSeeAll: false })).data!
    await chooseDeck(db, id, 'p1', 'd-p1')
    expect(startCheck((await getTable(db, id)).data!)).toBe('Il faut au moins 2 joueurs')
  })
})

describe('cycle de vie', () => {
  it('liste open et playing, plus récentes d’abord, sans les parties finies', async () => {
    const a = (await commander()).data!.id
    const b = (await commander()).data!.id
    const c = (await commander()).data!.id
    await db.prepare("UPDATE game_tables SET created_at = '2026-01-01 00:00:00' WHERE id = ?").bind(a).run()
    await markPlaying(db, b)
    await finishTable(db, c, 'p1')
    expect((await listTables(db)).data!.map((t) => t.id)).toEqual([b, a])
    expect((await playingTables(db)).data).toEqual([b])
    expect((await getTable(db, c)).data).toMatchObject({ status: 'finished', winnerPlayerId: 'p1' })
  })

  it('fin de partie : durée et temps de jeu de chaque joueur', async () => {
    const { id } = (await commander()).data!
    await joinTable(db, id, 'p2')
    expect((await getTable(db, id)).data!.durationSeconds).toBeNull()
    expect((await finishTable(db, id, 'p2', { duration: 3600, playTime: { p1: 1500, p2: 2100 } })).error).toBeNull()
    expect((await getTable(db, id)).data).toMatchObject({ status: 'finished', winnerPlayerId: 'p2', durationSeconds: 3600 })
    const seats = await db.prepare('SELECT player_id, play_seconds FROM game_seats WHERE table_id = ? ORDER BY seat').bind(id).all()
    expect(seats.results).toEqual([{ player_id: 'p1', play_seconds: 1500 }, { player_id: 'p2', play_seconds: 2100 }])
  })

  it('activité, tables périmées, hôte, suppression en cascade', async () => {
    const old = (await commander()).data!.id
    const fresh = (await commander()).data!.id
    await joinTable(db, old, 'p2')
    await touchActivity(db, old, new Date('2026-01-01T10:00:00Z'))
    await touchActivity(db, fresh, new Date('2026-01-09T10:00:00Z'))
    expect((await staleTables(db, new Date('2026-01-03T00:00:00Z'))).data).toEqual([old])

    await setHost(db, old, 'p2')
    expect((await getTable(db, old)).data!.hostPlayerId).toBe('p2')

    await deleteTable(db, old)
    expect((await getTable(db, old)).data).toBeNull()
    const seats = await db.prepare('SELECT COUNT(*) AS n FROM game_seats WHERE table_id = ?').bind(old).first<{ n: number }>()
    expect(seats!.n).toBe(0)
  })
})
