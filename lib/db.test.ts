import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getPlayer, updatePlayerProfile } from './db'

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  await db.prepare("INSERT INTO players (id, name, avatar_url) VALUES ('p1', 'Alex', 'https://img/a.png')").run()
})

describe('updatePlayerProfile', () => {
  it('ne modifie que le nom', async () => {
    const p = (await updatePlayerProfile(db, 'p1', { name: 'Alexandre' })).data!
    expect(p).toMatchObject({ name: 'Alexandre', avatar_url: 'https://img/a.png' })
  })

  it("vide l'avatar quand il vaut null", async () => {
    const p = (await updatePlayerProfile(db, 'p1', { avatar_url: null })).data!
    expect(p).toMatchObject({ name: 'Alex', avatar_url: null })
  })

  it('refuse un nom vide', async () => {
    expect((await updatePlayerProfile(db, 'p1', { name: '   ' })).error).toBe('Le nom est requis')
  })

  it('supprime les espaces autour du nom', async () => {
    expect((await updatePlayerProfile(db, 'p1', { name: '  Bob  ' })).data?.name).toBe('Bob')
  })
})

describe('getPlayer', () => {
  it('renvoie le joueur ou null', async () => {
    expect((await getPlayer(db, 'p1')).data?.name).toBe('Alex')
    expect((await getPlayer(db, 'inconnu')).data).toBeNull()
  })
})
