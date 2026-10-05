import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardName } from './apply'
import { canApply, isVisibleTo, zoneOf } from './rules'
import type { GameAction, GameState } from './types'

const game = () => run(setupFor('commander', 2), start(1))
const texts = (s: GameState) => s.log.map((l) => l.text)

describe('moveTop', () => {
  it('pose la carte du dessus sur mon champ de bataille, avec son nom au journal', () => {
    const s0 = game()
    const top = s0.players.p1.zones.library[0]
    const s = applyAction(s0, { type: 'moveTop', actor: 'p1', to: { player: 'p1', zone: 'battlefield' }, x: 20, y: 30 })
    expect(zoneOf(s, top)).toEqual({ player: 'p1', zone: 'battlefield' })
    expect(s.cards[top]).toMatchObject({ x: 20, y: 30 })
    expect(s.players.p1.zones.library).toHaveLength(s0.players.p1.zones.library.length - 1)
    expect(texts(s).at(-1)).toBe(`${cardName(s, top)} : bibliothèque → champ de bataille`)
  })

  it('vers la main : anonyme ; face cachée en exil : connue de l’auteur seul', () => {
    const s0 = game()
    const [a, b] = s0.players.p1.zones.library
    const s1 = applyAction(s0, { type: 'moveTop', actor: 'p1', to: { player: 'p1', zone: 'hand' } })
    expect(zoneOf(s1, a)).toEqual({ player: 'p1', zone: 'hand' })
    expect(texts(s1).at(-1)).toBe('une carte : bibliothèque → main')
    const s2 = applyAction(s1, { type: 'moveTop', actor: 'p1', to: { player: 'p1', zone: 'exile' }, faceDown: true })
    expect(s2.cards[b].faceDown).toBe(true)
    expect(isVisibleTo(s2, b, 'p1')).toBe(true)
    expect(isVisibleTo(s2, b, 'p2')).toBe(false)
  })

  it('refuse une zone d’un autre joueur et une bibliothèque vide', () => {
    const s0 = game()
    const toOther: GameAction = { type: 'moveTop', actor: 'p1', to: { player: 'p2', zone: 'graveyard' } }
    expect(applyAction(s0, toOther)).toBe(s0)
    expect(canApply(s0, toOther)).toBe('Tu ne peux déplacer cette carte que sur ton champ de bataille ou chez son propriétaire')
    const empty = applyAction(s0, { type: 'draw', actor: 'p1', count: 99 })
    expect(canApply(empty, { type: 'moveTop', actor: 'p1', to: { player: 'p1', zone: 'battlefield' } })).toBe('Bibliothèque vide')
  })
})

describe('endTurn byHost', () => {
  it('mentionne le passage par l’hôte au journal', () => {
    let s = game()
    s = applyAction(applyAction(s, { type: 'keep', actor: 'p1' }), { type: 'keep', actor: 'p2' })
    const active = s.activePlayer
    s = applyAction(s, { type: 'endTurn', actor: active, byHost: true })
    expect(texts(s).at(-1)).toMatch(/^Tour \d+ : .+ \(passé par l’hôte\)$/)
  })
})
