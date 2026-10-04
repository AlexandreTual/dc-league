import { describe, it, expect } from 'vitest'
import { testDeckCards } from '@/test/factories'
import { buildCatalog } from './catalog'
import { createInitialState } from './setup'
import { applyAction, bottomCount } from './apply'
import type { GameAction, GameState } from './types'

const { catalog } = buildCatalog('d1', testDeckCards())

function run(...actions: GameAction[]): GameState {
  return actions.reduce((s, a) => applyAction(s, a, catalog), createInitialState(catalog))
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

const texts = (s: GameState) => s.log.map((l) => l.text)
const total = (s: GameState) => Object.values(s.zones).reduce((n, z) => n + z.length, 0)
const occurrences = (s: GameState, id: string) => Object.values(s.zones).flat().filter((x) => x === id).length
const start = { type: 'start', seed: 1 } as const

describe('immuabilité', () => {
  it('ne modifie jamais l’état reçu', () => {
    const s = deepFreeze(run(start))
    expect(() => applyAction(s, { type: 'draw', count: 1 }, catalog)).not.toThrow()
    expect(() => applyAction(s, { type: 'move', id: s.zones.hand[0], to: 'battlefield' }, catalog)).not.toThrow()
    expect(() => applyAction(s, { type: 'nextTurn' }, catalog)).not.toThrow()
  })
})

describe('start, draw', () => {
  it('start mélange et pioche 7', () => {
    const s = run(start)
    expect(s.zones.hand).toHaveLength(7)
    expect(s.zones.library).toHaveLength(25)
    expect(s.stats.drawn).toBe(7)
    expect(texts(s)).toEqual(['Début de partie'])
    expect(run(start).zones.hand).toEqual(s.zones.hand)
    expect(run({ type: 'start', seed: 2 }).zones.hand).not.toEqual(s.zones.hand)
  })

  it('draw pioche depuis le dessus', () => {
    const before = run(start)
    const s = applyAction(before, { type: 'draw', count: 2 }, catalog)
    expect(s.zones.hand).toEqual([...before.zones.hand, ...before.zones.library.slice(0, 2)])
    expect(s.stats.drawn).toBe(9)
    expect(texts(s).at(-1)).toBe('Pioche 2 cartes')
  })

  it('draw sur une bibliothèque vide ne fait que le signaler', () => {
    const empty = run(start, { type: 'draw', count: 25 })
    const s = applyAction(empty, { type: 'draw', count: 1 }, catalog)
    expect(s.zones).toEqual(empty.zones)
    expect(texts(s).at(-1)).toBe('Bibliothèque vide')
  })
})

describe('mulligan', () => {
  it('le premier est gratuit, le second demande une carte en dessous', () => {
    const kept = run(start)
    const first = applyAction(kept, { type: 'mulligan', seed: 9 }, catalog)
    expect(first.zones.hand).toHaveLength(7)
    expect(first.zones.hand).not.toEqual(kept.zones.hand)
    expect(total(first)).toBe(total(kept))
    expect(first.stats.mulligans).toBe(1)
    expect(bottomCount(first)).toBe(0)
    expect(texts(first).at(-1)).toBe('Mulligan n°1 (gratuit)')

    const second = applyAction(first, { type: 'mulligan', seed: 10 }, catalog)
    expect(bottomCount(second)).toBe(1)
    expect(texts(second).at(-1)).toBe('Mulligan n°2 : mets 1 carte(s) en dessous')
  })
})

describe('move', () => {
  it('vers la bibliothèque : dessus par défaut, dessous sur demande, et anonyme', () => {
    const s0 = run(start)
    const [a, b] = s0.zones.hand
    const s1 = applyAction(s0, { type: 'move', id: a, to: 'library', position: 'bottom' }, catalog)
    expect(s1.zones.library.at(-1)).toBe(a)
    expect(texts(s1).at(-1)).toBe('une carte : main → bibliothèque (dessous)')
    const s2 = applyAction(s1, { type: 'move', id: b, to: 'library' }, catalog)
    expect(s2.zones.library[0]).toBe(b)
    expect(texts(s2).at(-1)).toBe('une carte : main → bibliothèque (dessus)')
  })

  it('à un index précis', () => {
    const s0 = run(start)
    const s = applyAction(s0, { type: 'move', id: s0.zones.hand[0], to: 'library', position: 2 }, catalog)
    expect(s.zones.library[2]).toBe(s0.zones.hand[0])
  })

  it('dans sa propre zone, sans doublon ni perte', () => {
    const s0 = run(start)
    const top = s0.zones.library[0]
    const s1 = applyAction(s0, { type: 'move', id: top, to: 'library', position: 'bottom' }, catalog)
    expect(s1.zones.library).toHaveLength(25)
    expect(s1.zones.library.at(-1)).toBe(top)
    expect(occurrences(s1, top)).toBe(1)

    const card = s0.zones.hand[0]
    const s2 = applyAction(s0, { type: 'move', id: card, to: 'battlefield', x: 10, y: 10 }, catalog)
    const s3 = applyAction(s2, { type: 'move', id: card, to: 'battlefield', x: 70, y: 20 }, catalog)
    expect(occurrences(s3, card)).toBe(1)
    expect(s3.cards[card]).toMatchObject({ x: 70, y: 20 })
    expect(total(s3)).toBe(total(s0))
  })

  it('vers le champ de bataille : position bornée et nom français dans le journal', () => {
    const s0 = run(start)
    const s = applyAction(s0, { type: 'move', id: 'c2-1', to: 'battlefield', x: 150, y: -5 }, catalog)
    expect(s.cards['c2-1']).toMatchObject({ x: 100, y: 0 })
    expect(texts(s).at(-1)).toMatch(/^Anneau solaire : .* → champ de bataille$/)
  })

  it('compte un terrain posé depuis la main, pas depuis le cimetière', () => {
    const s0 = run(start)
    const forest = Object.keys(s0.cards).find((id) => id.startsWith('c3-') && !s0.zones.hand.includes(id))!
    const handForest = s0.zones.hand.find((id) => id.startsWith('c3-'))
    const fromGraveyard = applyAction(
      applyAction(s0, { type: 'move', id: forest, to: 'graveyard' }, catalog),
      { type: 'move', id: forest, to: 'battlefield' },
      catalog,
    )
    expect(fromGraveyard.stats.landsPlayed).toBe(0)
    if (handForest) {
      expect(applyAction(s0, { type: 'move', id: handForest, to: 'battlefield' }, catalog).stats.landsPlayed).toBe(1)
    }
    const fromHand = applyAction(
      applyAction(s0, { type: 'move', id: forest, to: 'hand' }, catalog),
      { type: 'move', id: forest, to: 'battlefield' },
      catalog,
    )
    expect(fromHand.stats.landsPlayed).toBe(1)
  })

  it('remet à zéro une carte qui quitte le champ de bataille', () => {
    let s = run(start, { type: 'move', id: 'c2-1', to: 'battlefield' }, { type: 'tap', id: 'c2-1' })
    s = { ...s, cards: { ...s.cards, 'c2-1': { ...s.cards['c2-1'], counters: { plus: 2, minus: 1, other: 3 }, flipped: true } } }
    s = applyAction(s, { type: 'move', id: 'c2-1', to: 'graveyard' }, catalog)
    expect(s.cards['c2-1']).toMatchObject({ tapped: false, flipped: false, counters: { plus: 0, minus: 0, other: 0 } })
  })

  it('compte les lancements du commandant à l’aller seulement', () => {
    let s = run(start, { type: 'move', id: 'c1-1', to: 'battlefield' })
    expect(s.commanderCasts['c1-1']).toBe(1)
    s = applyAction(s, { type: 'move', id: 'c1-1', to: 'command' }, catalog)
    expect(s.commanderCasts['c1-1']).toBe(1)
    s = applyAction(s, { type: 'move', id: 'c1-1', to: 'battlefield' }, catalog)
    expect(s.commanderCasts['c1-1']).toBe(2)
  })

  it('ignore une carte inconnue', () => {
    const s0 = run(start)
    expect(applyAction(s0, { type: 'move', id: 'zzz', to: 'hand' }, catalog)).toEqual(s0)
  })
})

describe('tap, untapAll, life, nextTurn', () => {
  it('tap ne vaut que sur le champ de bataille', () => {
    const s0 = run(start, { type: 'move', id: 'c2-1', to: 'battlefield' })
    expect(applyAction(s0, { type: 'tap', id: 'c2-1' }, catalog).cards['c2-1'].tapped).toBe(true)
    const inHand = s0.zones.hand[0]
    expect(applyAction(s0, { type: 'tap', id: inHand }, catalog).cards[inHand].tapped).toBe(false)
  })

  it('untapAll dégage tout', () => {
    const s = run(start, { type: 'move', id: 'c2-1', to: 'battlefield' }, { type: 'tap', id: 'c2-1' }, { type: 'untapAll' })
    expect(s.cards['c2-1'].tapped).toBe(false)
  })

  it('life ajuste et journalise', () => {
    const s = run(start, { type: 'life', delta: -3 })
    expect(s.life).toBe(37)
    expect(texts(s).at(-1)).toBe('Points de vie : 40 → 37')
  })

  it('nextTurn passe au tour suivant, dégage et pioche', () => {
    const s0 = run(start, { type: 'move', id: 'c2-1', to: 'battlefield' }, { type: 'tap', id: 'c2-1' })
    const s = applyAction(s0, { type: 'nextTurn' }, catalog)
    expect(s.turn).toBe(2)
    expect(s.cards['c2-1'].tapped).toBe(false)
    expect(s.zones.hand).toHaveLength(s0.zones.hand.length + 1)
    expect(s.log.at(-1)).toEqual({ turn: 2, text: 'Tour 2' })
  })
})
