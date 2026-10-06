// Données locales pour scripts/online-check.mjs : 4 joueurs, une session chacun (jeton connu), un deck importé chacun.
// Usage : node scripts/seed-online.mjs > /tmp/seed-online.sql && npx wrangler d1 execute dc-league --local --file /tmp/seed-online.sql
import { createHash } from 'node:crypto'

export const PLAYERS = [
  { id: 'e2e-1', name: 'Ana' },
  { id: 'e2e-2', name: 'Bastien' },
  { id: 'e2e-3', name: 'Chloé' },
  { id: 'e2e-4', name: 'Damien' },
]
export const tokenOf = (id) => `jeton-de-test-${id}`

const CARDS = [
  { id: 'e2e-ken', name: 'Kenrith, the Returned King', type: 'Legendary Creature — Human Noble', qty: 1, section: 'commander' },
  { id: 'e2e-sol', name: 'Sol Ring', fr: 'Anneau solaire', type: 'Artifact', qty: 1, section: 'main' },
  { id: 'e2e-elf', name: 'Llanowar Elves', type: 'Creature — Elf Druid', qty: 4, section: 'main' },
  { id: 'e2e-avenger', name: 'Avenger of Zendikar', type: 'Creature — Elemental', qty: 1, section: 'main' },
  { id: 'e2e-forest', name: 'Forest', fr: 'Forêt', type: 'Basic Land — Forest', qty: 29, section: 'main' },
]

// Jetons du deck (issue #41) : ceux que créent les cartes ci-dessus, comme après un import.
const TOKENS = [
  { id: 'e2e-plant', name: 'Plante', type: 'Token Creature — Plant', power: '0', toughness: '1', colors: ['G'], sources: ['Avenger of Zendikar'] },
]

const q = (v) => (v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`)
const svg = (name) =>
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="244" height="340"><rect width="244" height="340" rx="14" fill="#e8dcb0"/><text x="16" y="40" font-size="16">${name}</text></svg>`,
  ).toString('base64')

const lines = []
for (const c of CARDS) {
  for (const lang of c.fr ? ['en', 'fr'] : ['en']) {
    const id = `${c.id}-${lang}`
    const printed = lang === 'fr' ? c.fr : null
    lines.push(
      `INSERT OR REPLACE INTO cards (id, oracle_id, lang, name, printed_name, set_code, collector_number, cmc, mana_cost, type_line, printed_type_line, colors, color_identity, image_normal, image_small, fetched_at) VALUES (${[id, c.id, lang, c.name, printed, 'tst', '1', 0, null, c.type, null, '[]', '[]', svg(printed ?? c.name), svg(printed ?? c.name), '2026-10-04'].map(q).join(', ')});`,
    )
  }
}
const expires = '2099-01-01T00:00:00.000Z'
for (const p of PLAYERS) {
  const hash = createHash('sha256').update(tokenOf(p.id)).digest('hex')
  lines.push(
    `INSERT OR IGNORE INTO players (id, name) VALUES (${q(p.id)}, ${q(p.name)});`,
    `INSERT OR IGNORE INTO users (id, player_id, username, password_hash) VALUES (${q(`u-${p.id}`)}, ${q(p.id)}, ${q(`e2e-${p.name}`)}, NULL);`,
    `INSERT OR REPLACE INTO sessions (id, user_id, expires_at) VALUES (${q(hash)}, ${q(`u-${p.id}`)}, ${q(expires)});`,
    `INSERT OR IGNORE INTO decks (id, player_id, name) VALUES (${q(`deck-${p.id}`)}, ${q(p.id)}, ${q(`Kenrith de ${p.name}`)});`,
    `DELETE FROM deck_cards WHERE deck_id = ${q(`deck-${p.id}`)};`,
    `DELETE FROM deck_tokens WHERE deck_id = ${q(`deck-${p.id}`)};`,
  )
  for (const t of TOKENS) {
    lines.push(
      `INSERT INTO deck_tokens (deck_id, token_scryfall_id, name, type_line, power, toughness, colors, image, source_names) VALUES (${[`deck-${p.id}`, t.id, t.name, t.type, t.power, t.toughness, JSON.stringify(t.colors), null, JSON.stringify(t.sources)].map(q).join(', ')});`,
    )
  }
  CARDS.forEach((c, i) =>
    lines.push(
      `INSERT INTO deck_cards (deck_id, position, quantity, section, requested_name, en_card_id, fr_card_id) VALUES (${[`deck-${p.id}`, i + 1, c.qty, c.section, c.name, `${c.id}-en`, c.fr ? `${c.id}-fr` : null].map(q).join(', ')});`,
    ),
  )
}
// Les tables de jeu des essais précédents de ces joueurs sont effacées.
lines.push(`DELETE FROM game_seats WHERE table_id IN (SELECT id FROM game_tables WHERE host_player_id LIKE 'e2e-%');`)
lines.push(`DELETE FROM game_tables WHERE host_player_id LIKE 'e2e-%';`)

if (import.meta.url === `file://${process.argv[1]}`) console.log(lines.join('\n'))
