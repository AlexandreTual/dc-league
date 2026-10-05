import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createTestDb } from '@/test/d1'
import { cardRow, seedCache } from '@/test/factories'
import { listDeckCards } from '@/lib/db-cards'
import { lookupKey, parseDeckList } from './parse'
import { commitDeckList } from './commit'

const fixture = readFileSync(path.join(__dirname, '../../test/fixtures/moxfield-export.txt'), 'utf8')

let db: D1Database

async function deckImage() {
  const row = await db.prepare("SELECT commander_image_url FROM decks WHERE id = 'd1'").first<{ commander_image_url: string | null }>()
  return row?.commander_image_url
}

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')"),
    db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Kenrith')"),
  ])
  // Toutes les lignes de l'export sont en cache ; seuls Kenrith et Sol Ring ont une version française.
  const { lines } = parseDeckList(fixture)
  await seedCache(
    db,
    lines.map((l, i) => {
      const en = cardRow({ id: `en-${i}`, name: l.name, image_normal: `https://img/en-${i}.jpg` })
      const fr = ['Kenrith, the Returned King', 'Sol Ring'].includes(l.name)
        ? cardRow({ id: `fr-${i}`, lang: 'fr', name: l.name, image_normal: `https://img/fr-${i}.jpg` })
        : null
      return { key: lookupKey(l), en, fr }
    }),
  )
})

describe('commitDeckList', () => {
  it('enregistre un export complet et renvoie le résumé', async () => {
    const r = await commitDeckList(db, 'd1', fixture)
    expect(r.data).toEqual({ total: 100, commanders: 1, frenchCount: 2, notFound: [], ignored: 2, errors: [] })
    const cards = (await listDeckCards(db, 'd1')).data!
    expect(cards).toHaveLength(40)
    expect(cards[0]).toMatchObject({ section: 'commander', requested_name: 'Kenrith, the Returned King' })
  })

  it('met à jour l’image du commandant avec la version française', async () => {
    await commitDeckList(db, 'd1', fixture)
    expect(await deckImage()).toBe('https://img/fr-0.jpg')
  })

  it('une ligne absente du cache est introuvable', async () => {
    const r = await commitDeckList(db, 'd1', `${fixture}\nDeck\n2 Carte Inconnue`)
    expect(r.data?.notFound).toEqual([{ lineNumber: 50, text: '2 Carte Inconnue' }])
    expect(r.data?.total).toBe(102)
    expect((await listDeckCards(db, 'd1')).data!.at(-1)).toMatchObject({ requested_name: 'Carte Inconnue', en: null })
  })

  it('réimport sans commandant : efface l’ancienne image', async () => {
    await db.prepare("UPDATE decks SET commander_image_url = 'https://old.jpg' WHERE id = 'd1'").run()
    const r = await commitDeckList(db, 'd1', '1 Sol Ring (C21) 263')
    expect(r.error).toBeNull()
    expect(await deckImage()).toBeNull()
  })

  it('une erreur d’enregistrement de l’image est renvoyée', async () => {
    const failing = new Proxy(db, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql: string) => {
            if (sql.startsWith('UPDATE decks SET commander_image_url')) throw new Error('D1 en panne')
            return target.prepare(sql)
          }
        }
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const r = await commitDeckList(failing, 'd1', fixture)
    expect(r).toEqual({ data: null, error: 'D1 en panne' })
  })

  it('refuse une liste vide ou trop longue', async () => {
    expect((await commitDeckList(db, 'd1', '  \n# rien')).error).toBe('EMPTY')
    expect((await commitDeckList(db, 'd1', Array(251).fill('1 Forest').join('\n'))).error).toBe('TOO_LONG')
  })
})
