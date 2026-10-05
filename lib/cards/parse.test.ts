import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { lookupKey, parseDeckList, validateBatch } from './parse'

describe('parseDeckList : formats de ligne', () => {
  it.each([
    ['1 Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
    ['1x Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
    ['Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
    ['30 Forest', { quantity: 30, name: 'Forest', set: null, number: null }],
    ['1 Sol Ring (C21) 263', { quantity: 1, name: 'Sol Ring', set: 'C21', number: '263' }],
    ['1 Sol Ring (C21) 263 *F*', { quantity: 1, name: 'Sol Ring', set: 'C21', number: '263' }],
    ['1 Kenrith, the Returned King (ELD) 303 *CMDR*', { quantity: 1, name: 'Kenrith, the Returned King', set: 'ELD', number: '303' }],
    ['1 Delver of Secrets // Insectile Aberration (ISD) 51', { quantity: 1, name: 'Delver of Secrets // Insectile Aberration', set: 'ISD', number: '51' }],
    ['1 Forest (SLD) 2024-1', { quantity: 1, name: 'Forest', set: 'SLD', number: '2024-1' }],
    ['1 Island (PLST) 123a', { quantity: 1, name: 'Island', set: 'PLST', number: '123a' }],
    ['1 Fire // Ice', { quantity: 1, name: 'Fire // Ice', set: null, number: null }],
    ['1X Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
    ['1 x Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
    ['2 X Sol Ring', { quantity: 2, name: 'Sol Ring', set: null, number: null }],
    ['1 Xenagos, God of Revels', { quantity: 1, name: 'Xenagos, God of Revels', set: null, number: null }],
    ['1x Sol Ring (cmr) 472 [Ramp]', { quantity: 1, name: 'Sol Ring', set: 'cmr', number: '472' }],
    ['1x Sol Ring (cmr) 472 *F* [Ramp,Artifact]', { quantity: 1, name: 'Sol Ring', set: 'cmr', number: '472' }],
    ['1x Sol Ring [Ramp]', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
  ])('lit « %s »', (text, expected) => {
    expect(parseDeckList(text).lines[0]).toEqual({ ...expected, section: 'main', lineNumber: 1 })
  })
})

describe('parseDeckList : sections', () => {
  it.each(['Commander', 'COMMANDER:', '// Commander'])('reconnaît l’en-tête %s', (header) => {
    const r = parseDeckList(`${header}\n1 Kenrith\n\nDeck\n1 Sol Ring`)
    expect(r.lines.map((l) => [l.name, l.section])).toEqual([
      ['Kenrith', 'commander'],
      ['Sol Ring', 'main'],
    ])
  })

  it('reconnaît les en-têtes avec compte « Commander (1) » et « Deck (99) »', () => {
    const r = parseDeckList('Commander (1)\n1 Kenrith\n\nDeck (99)\n1 Sol Ring')
    expect(r.lines.map((l) => [l.name, l.section])).toEqual([
      ['Kenrith', 'commander'],
      ['Sol Ring', 'main'],
    ])
    expect(r.errors).toEqual([])
  })

  it('en-tête « Sideboard (3) » : lignes ignorées', () => {
    const r = parseDeckList('1 Sol Ring\nSideboard (1)\n1 Duress')
    expect(r.lines.map((l) => l.name)).toEqual(['Sol Ring'])
    expect(r.ignored).toBe(1)
  })

  it('catégorie [Commander] (Archidekt) → section commandant', () => {
    const r = parseDeckList('1x Kenrith, the Returned King (eld) 303 [Commander{top}]\n1x Sol Ring (cmr) 472 [Ramp]\n1x Arcane Signet [Ramp,Commander]')
    expect(r.lines.map((l) => [l.name, l.section])).toEqual([
      ['Kenrith, the Returned King', 'commander'],
      ['Sol Ring', 'main'],
      ['Arcane Signet', 'commander'],
    ])
  })

  it('catégories hors deck (Archidekt) : lignes ignorées', () => {
    const r = parseDeckList(
      '1x Sol Ring [Ramp]\n1x Duress (m19) 94 [Sideboard]\n1x Negate [Maybeboard{noDeck}{noPrice}]\n1x Opt [Idées{noDeck}]',
    )
    expect(r.lines.map((l) => l.name)).toEqual(['Sol Ring'])
    expect(r.ignored).toBe(3)
    expect(r.errors).toEqual([])
  })

  it('ignore et compte les lignes « SB: »', () => {
    const r = parseDeckList('1 Sol Ring\nSB: 1 Duress\nSB:2 Negate')
    expect(r.lines.map((l) => l.name)).toEqual(['Sol Ring'])
    expect(r.ignored).toBe(2)
    expect(r.errors).toEqual([])
  })

  it('ignore et compte réserve et maybeboard', () => {
    const r = parseDeckList('1 Sol Ring\nSideboard\n1 Duress\n2 Negate\nMaybeboard\n1 X\nDeck\n1 Arcane Signet')
    expect(r.lines.map((l) => l.name)).toEqual(['Sol Ring', 'Arcane Signet'])
    expect(r.ignored).toBe(3)
  })

  it('lit CRLF, espaces insécables et ignore les commentaires', () => {
    const r = parseDeckList('# mon deck\r\n1 Sol Ring\r\n\r\n1 Arcane Signet')
    expect(r.lines.map((l) => [l.lineNumber, l.name])).toEqual([
      [2, 'Sol Ring'],
      [4, 'Arcane Signet'],
    ])
    expect(r.errors).toEqual([])
    expect(r.ignored).toBe(0)
  })
})

describe('parseDeckList : erreurs et limites', () => {
  it.each(['0 Sol Ring', '100 Forest', '3'])('signale « %s »', (text) => {
    expect(parseDeckList(`1 Sol Ring\n${text}`).errors).toEqual([{ lineNumber: 2, text }])
  })

  it('signale une liste de plus de 250 lignes', () => {
    expect(parseDeckList(Array(251).fill('1 Forest').join('\n')).tooLong).toBe(true)
    expect(parseDeckList(Array(250).fill('1 Forest').join('\n')).tooLong).toBe(false)
  })

  it('lit un export Moxfield complet', () => {
    const text = readFileSync(path.join(__dirname, '../../test/fixtures/moxfield-export.txt'), 'utf8')
    const r = parseDeckList(text)
    expect(r.lines.filter((l) => l.section === 'commander').map((l) => l.name)).toEqual(['Kenrith, the Returned King'])
    expect(r.lines.reduce((n, l) => n + l.quantity, 0)).toBe(100)
    expect(r.errors).toEqual([])
    expect(r.ignored).toBe(2)
  })
})

describe('lookupKey', () => {
  it('normalise nom, édition et numéro', () => {
    expect(lookupKey({ name: '  Sol   Ring ', set: 'C21', number: '263' })).toBe('sol ring|c21|263')
  })
  it('laisse vides les parties absentes', () => {
    expect(lookupKey({ name: 'Sol Ring', set: null, number: null })).toBe('sol ring||')
  })
})

describe('validateBatch', () => {
  const ok = { lineNumber: 1, quantity: 1, name: 'Sol Ring', set: null, number: null, section: 'main' }

  it('accepte un paquet valide et ne garde que les champs attendus', () => {
    expect(validateBatch([{ ...ok, extra: 'x' }, { ...ok, set: 'C21', number: '263', section: 'commander' }])).toEqual([
      ok,
      { ...ok, set: 'C21', number: '263', section: 'commander' },
    ])
  })

  it.each([
    ['pas un tableau', { lines: [] }],
    ['vide', []],
    ['plus de 20 lignes', Array(21).fill(ok)],
    ['quantité invalide', [{ ...ok, quantity: 0 }]],
    ['nom vide', [{ ...ok, name: '  ' }]],
    ['section inconnue', [{ ...ok, section: 'sideboard' }]],
    ['édition non textuelle', [{ ...ok, set: 12 }]],
  ])('refuse un paquet %s', (_label, value) => {
    expect(validateBatch(value)).toBeNull()
  })
})
