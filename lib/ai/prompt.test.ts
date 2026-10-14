import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import { buildContents, cardsBlock, SYSTEM_INSTRUCTION } from './prompt'
import type { AiCard, ChatMessage } from './types'

const sol: AiCard = {
  en: cardRow(),
  fr: cardRow({ id: 'sol-fr', lang: 'fr', printed_name: 'Anneau solaire', printed_text: '{T} : Ajoutez {C}{C}.' }),
  rulings: [{ date: '2021-04-23', source: 'wotc', text: 'Sol Ring is colorless.' }],
}
const bolt: AiCard = {
  en: cardRow({ id: 'bolt', oracle_id: 'oracle-bolt', name: 'Lightning Bolt', mana_cost: '{R}', type_line: 'Instant', oracle_text: 'Lightning Bolt deals 3 damage to any target.' }),
  fr: null,
  rulings: [],
}
const delver: AiCard = {
  en: cardRow({
    id: 'delver', oracle_id: 'oracle-delver', name: 'Delver of Secrets // Insectile Aberration', mana_cost: null, type_line: 'Creature — Human Wizard // Creature — Human Insect', oracle_text: null,
    faces: [
      { name: 'Delver of Secrets', printed_name: null, mana_cost: '{U}', type_line: 'Creature — Human Wizard', printed_type_line: null, oracle_text: 'At the beginning of your upkeep, look at the top card of your library.', printed_text: null, image_normal: 'a', image_small: 'a' },
      { name: 'Insectile Aberration', printed_name: null, mana_cost: '', type_line: 'Creature — Human Insect', printed_type_line: null, oracle_text: 'Flying', printed_text: null, image_normal: 'b', image_small: 'b' },
    ],
  }),
  fr: null,
  rulings: [],
}

describe('consigne', () => {
  it('demande un arbitre Commander qui répond en français à partir des textes fournis', () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/arbitre/i)
    expect(SYSTEM_INSTRUCTION).toMatch(/Commander/)
    expect(SYSTEM_INSTRUCTION).toMatch(/en français/)
    expect(SYSTEM_INSTRUCTION).toMatch(/noms français/)
    expect(SYSTEM_INSTRUCTION).toMatch(/texte Oracle/)
    expect(SYSTEM_INSTRUCTION).toMatch(/ne suffisent pas/)
    expect(SYSTEM_INSTRUCTION).toMatch(/autres sujets/)
  })
})

describe('bloc des cartes', () => {
  it('donne noms, coût, type, Oracle, texte français et règles datées', () => {
    const block = cardsBlock([sol])
    expect(block).toContain('Sol Ring')
    expect(block).toContain('Anneau solaire')
    expect(block).toContain('{1}')
    expect(block).toContain('Artifact')
    expect(block).toContain('{T}: Add {C}{C}.')
    expect(block).toContain('{T} : Ajoutez {C}{C}.')
    expect(block).toContain('2021-04-23 : Sol Ring is colorless.')
  })

  it('signale une carte sans texte français ni règles', () => {
    const block = cardsBlock([bolt])
    expect(block).toContain('Lightning Bolt deals 3 damage to any target.')
    expect(block).not.toContain('Texte imprimé français')
    expect(block).toContain('Aucune règle publiée')
  })

  it('donne une section par face pour une carte recto verso', () => {
    const block = cardsBlock([delver])
    expect(block).toContain('Face 1 : Delver of Secrets')
    expect(block).toContain('{U}')
    expect(block).toContain('Face 2 : Insectile Aberration')
    expect(block).toContain('Flying')
  })

  it('numérote les cartes', () => {
    const block = cardsBlock([sol, bolt])
    expect(block.indexOf('Carte 1')).toBeLessThan(block.indexOf('Carte 2'))
  })
})

describe('contenu envoyé', () => {
  const ask = (n: number): ChatMessage[] =>
    Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', text: `message ${i}` }) as ChatMessage)

  it('met le bloc des cartes avant la première question, rôles user / model', () => {
    const contents = buildContents([sol], [{ role: 'user', text: 'Explique cette carte' }])
    expect(contents).toHaveLength(1)
    expect(contents[0].role).toBe('user')
    expect(contents[0].parts[0].text).toContain('Sol Ring')
    expect(contents[0].parts[0].text.endsWith('Explique cette carte')).toBe(true)

    const follow = buildContents([sol], [...ask(2), { role: 'user', text: 'Et ensuite ?' }])
    expect(follow.map((c) => c.role)).toEqual(['user', 'model', 'user'])
    expect(follow[1].parts[0].text).toBe('message 1')
    expect(follow[2].parts[0].text).toBe('Et ensuite ?')
  })

  it('garde les 10 derniers messages, en commençant par une question, cartes toujours en tête', () => {
    const contents = buildContents([sol], ask(15))
    expect(contents.length).toBeLessThanOrEqual(10)
    expect(contents[0].role).toBe('user')
    expect(contents[0].parts[0].text).toContain('Sol Ring')
    expect(contents[contents.length - 1].parts[0].text).toBe('message 14')
  })
})
