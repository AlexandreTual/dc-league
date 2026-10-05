import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { createRng } from './random'
import { applyAction } from './apply'
import { canApply, isVisibleTo } from './rules'
import { viewFor } from './view'
import { MANA_COLORS, PLAYER_ZONES, type GameAction, type GameState, type PlayerZone } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const sol = (p: string) => card(p, 2)
const game = (n = 3, eliminatedSeeAll = false) => run(setupFor('commander', n, { eliminatedSeeAll }), start(1))

describe('viewFor', () => {
  it('ma main visible, mains adverses cachées sans aucune information', () => {
    const s = game()
    const v = viewFor(s, 'p1')
    expect(v.me).toBe('p1')
    expect(v.players.p1.zones.hand.map((c) => (c.hidden ? null : c.id))).toEqual(s.players.p1.zones.hand)
    expect(v.players.p2.zones.hand).toHaveLength(7)
    for (const c of v.players.p2.zones.hand) expect(Object.keys(c)).toEqual(['hidden'])
    expect(v.players.p2.zones.library).toEqual({ count: 25, visible: [] })
    expect(v.canUndo).toBe(false)
    expect(viewFor(s, 'p1', true).canUndo).toBe(true)
  })

  it('exil face cachée visible par l’exilant seulement', () => {
    let s = place(game(), [{ id: sol('p2'), player: 'p2', zone: 'graveyard' }])
    s = applyAction(s, { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p2', zone: 'exile' }, faceDown: true })
    expect(viewFor(s, 'p1').players.p2.zones.exile[0]).toMatchObject({ hidden: false, id: sol('p2'), faceDown: true })
    expect(viewFor(s, 'p2').players.p2.zones.exile[0]).toEqual({ hidden: true })
  })

  it('bibliothèque : cartes regardées et dessus révélé, avec leur position', () => {
    let s = applyAction(game(), { type: 'look', actor: 'p1', target: 'p2', count: 2 })
    const lib = s.players.p2.zones.library
    expect(viewFor(s, 'p1').players.p2.zones.library.visible.map((v) => [v.index, v.card.id])).toEqual([[0, lib[0]], [1, lib[1]]])
    expect(viewFor(s, 'p1').lookingAt).toEqual(['p2'])
    expect(viewFor(s, 'p3').players.p2.zones.library.visible).toEqual([])
    s = applyAction(s, { type: 'toggleTopRevealed', actor: 'p3' })
    expect(viewFor(s, 'p2').players.p3.zones.library.visible.map((v) => v.index)).toEqual([0])
  })

  it('joueur éliminé : tout visible avec l’option, règle normale sinon', () => {
    const withOption = applyAction(game(3, true), { type: 'eliminate', actor: 'p3', target: 'p3' })
    const v = viewFor(withOption, 'p3')
    expect(v.players.p1.zones.hand.every((c) => !c.hidden)).toBe(true)
    expect(v.players.p1.zones.library.visible).toHaveLength(withOption.players.p1.zones.library.length)
    const without = applyAction(game(3, false), { type: 'eliminate', actor: 'p3', target: 'p3' })
    expect(viewFor(without, 'p3').players.p1.zones.hand.every((c) => c.hidden)).toBe(true)
  })

  it('journal filtré : la ligne privée de look reste chez l’auteur', () => {
    const s = applyAction(game(), { type: 'look', actor: 'p1', target: 'p2', count: 3 })
    expect(viewFor(s, 'p1').log.at(-1)?.text).toMatch(/^Tu as vu : /)
    expect(viewFor(s, 'p2').log.some((l) => l.text.startsWith('Tu as vu'))).toBe(false)
    expect(viewFor(s, 'p2').log.at(-1)).toEqual({ turn: s.turn, actor: 'p1', text: 'regarde les 3 cartes du dessus de la bibliothèque de Bob' })
  })
})

describe('anti-fuite', () => {
  it('200 actions aléatoires : aucun identifiant de carte invisible dans la vue', () => {
    const rng = createRng(42)
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]
    const ids = ['p1', 'p2', 'p3', 'p4']
    let s = game(4)
    s = apply(s, ...ids.map((p) => ({ type: 'keep', actor: p }) as GameAction))

    const randomAction = (): GameAction => {
      const actor = pick(ids)
      const allCards = Object.keys(s.cards)
      switch (pick(['draw', 'move', 'move', 'move', 'look', 'endLook', 'reveal', 'faceDown', 'endTurn', 'createToken', 'search', 'toggleTop', 'revealTop', 'peekTop', 'reorder', 'mana', 'clearMana', 'keepMana'])) {
        case 'draw':
          return { type: 'draw', actor, count: 1 }
        case 'move': {
          const id = pick(allCards)
          const zone: PlayerZone = pick(PLAYER_ZONES)
          const player = rng() < 0.5 ? actor : s.cards[id].owner
          return { type: 'move', actor, id, to: { player, zone }, faceDown: rng() < 0.2, position: pick(['top', 'bottom', 3] as const) }
        }
        case 'look':
          return { type: 'look', actor, target: pick(ids), count: 1 + Math.floor(rng() * 3) }
        case 'search':
          return { type: 'search', actor, target: pick(ids) }
        case 'endLook':
          return { type: 'endLook', actor, target: pick(ids), shuffle: rng() < 0.5, seed: Math.floor(rng() * 1000) }
        case 'reveal': {
          const hand = s.players[actor].zones.hand
          return { type: 'reveal', actor, ids: hand.length ? [pick(hand)] : 'hand', to: rng() < 0.3 ? 'all' : [pick(ids)] }
        }
        case 'faceDown':
          return { type: 'faceDown', actor, id: pick(allCards) }
        case 'endTurn':
          return { type: 'endTurn', actor: s.activePlayer }
        case 'revealTop':
          return { type: 'revealTop', actor }
        case 'peekTop':
          return { type: 'togglePeekTop', actor }
        case 'mana':
          return { type: 'mana', actor, color: pick(MANA_COLORS), delta: pick([1, 5, -1]) }
        case 'clearMana':
          return { type: 'clearMana', actor }
        case 'keepMana':
          return { type: 'toggleKeepMana', actor }
        case 'reorder': {
          // Ce que l'auteur voit en ce moment dans une bibliothèque qu'il regarde, dans un autre ordre.
          const target = pick(s.lookingAt[actor] ?? ids)
          const seen = s.players[target].zones.library.filter((id) => isVisibleTo(s, id, actor)).slice(0, 3)
          return { type: 'reorderTop', actor, target, ids: [...seen].reverse() }
        }
        case 'toggleTop':
          return { type: 'toggleTopRevealed', actor }
        default:
          return { type: 'createToken', actor, token: { name: 'Soldat', typeLine: 'Token Creature', power: '1', toughness: '1', colors: [], image: null }, x: 10, y: 10 }
      }
    }

    let applied = 0
    for (let i = 0; i < 200; i++) {
      const action = randomAction()
      if (canApply(s, action) !== null) continue
      s = applyAction(s, action)
      applied++
      for (const viewer of ids) {
        const json = JSON.stringify(viewFor(s, viewer))
        for (const id of Object.keys(s.cards)) {
          // Les commandants sont publics : leur identifiant sert de clé à la taxe et aux blessures.
          if (s.cards[id].isCommander || isVisibleTo(s, id, viewer)) continue
          expect(json.includes(`"${id}"`), `${id} visible par ${viewer} après ${JSON.stringify(action)}`).toBe(false)
        }
      }
    }
    expect(applied).toBeGreaterThan(100)
  })
})
