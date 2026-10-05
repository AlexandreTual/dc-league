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

  it('garde l’image existante sans commandant trouvé', async () => {
    await db.prepare("UPDATE decks SET commander_image_url = 'https://old.jpg' WHERE id = 'd1'").run()
    await commitDeckList(db, 'd1', '1 Sol Ring (C21) 263')
    expect(await deckImage()).toBe('https://old.jpg')
  })

  it('refuse une liste vide ou trop longue', async () => {
    expect((await commitDeckList(db, 'd1', '  \n# rien')).error).toBe('EMPTY')
    expect((await commitDeckList(db, 'd1', Array(251).fill('1 Forest').join('\n'))).error).toBe('TOO_LONG')
  })
})
