import { fr } from '@/lib/i18n/messages'
import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { canApply } from './rules'
import { cardMenu } from './menus'
import { parseClientAction } from './validate'
import { viewFor } from './view'
import type { GameAction, GameState, VisibleCard } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const a = card('p1', 2)
const b = card('p1', 3)
const c = card('p1', 4)
const BF = { player: 'p1', zone: 'battlefield' } as const

function game(): GameState {
  const s = run(setupFor('commander', 2), start(1))
  return place(s, [
    { id: a, player: 'p1', zone: 'battlefield' },
    { id: b, player: 'p1', zone: 'battlefield' },
    { id: c, player: 'p1', zone: 'battlefield' },
  ])
}
const order = (s: GameState) => s.players.p1.zones.battlefield

describe('superposition des cartes en jeu', () => {
  it('une carte déplacée sur son champ de bataille passe devant les autres', () => {
    const s = applyAction(game(), { type: 'move', actor: 'p1', id: a, to: BF, x: 40, y: 60 })
    expect(order(s)).toEqual([b, c, a])
    expect(s.cards[a]).toMatchObject({ x: 40, y: 60 })
  })

  it('position « top » la met derrière toutes les autres, sans la déplacer', () => {
    const s0 = applyAction(game(), { type: 'move', actor: 'p1', id: c, to: BF, x: 30, y: 30 })
    const s = applyAction(s0, { type: 'move', actor: 'p1', id: c, to: BF, position: 'top' })
    expect(order(s)).toEqual([c, a, b])
    expect(s.cards[c]).toMatchObject({ x: 30, y: 30 })
  })

  it('menu : mettre devant / derrière', () => {
    const s = game()
    const view = viewFor(s, 'p1')
    const visible = view.players.p1.zones.battlefield.find((v): v is VisibleCard => !v.hidden && v.id === b)!
    const entries = cardMenu({ view, me: 'p1', catalogs: s.catalogs, lang: 'fr', t: fr, readOnly: false } as never, visible, BF)
    const labels = entries.flatMap((e) => ('label' in e ? [e.label] : []))
    expect(labels).toEqual(expect.arrayContaining(['Mettre devant', 'Mettre derrière', 'Pivoter à 180°']))
  })
})

describe('pivoter une carte', () => {
  it('pivote et revient ; la vue le montre ; quitter le champ de bataille l’annule', () => {
    let s = applyAction(game(), { type: 'rotate', actor: 'p1', id: a })
    expect(s.cards[a].rotated).toBe(true)
    expect(viewFor(s, 'p2').players.p1.zones.battlefield.find((v) => !v.hidden && v.id === a)).toMatchObject({ rotated: true })
    expect(applyAction(s, { type: 'rotate', actor: 'p1', id: a }).cards[a].rotated).toBeUndefined()
    s = applyAction(s, { type: 'move', actor: 'p1', id: a, to: { player: 'p1', zone: 'hand' } })
    expect(s.cards[a].rotated).toBeUndefined()
  })

  it('réservé au contrôleur, sur le champ de bataille', () => {
    expect(canApply(game(), { type: 'rotate', actor: 'p2', id: a })).not.toBeNull()
    const s = applyAction(game(), { type: 'move', actor: 'p1', id: a, to: { player: 'p1', zone: 'hand' } })
    expect(canApply(s, { type: 'rotate', actor: 'p1', id: a })).not.toBeNull()
    expect(canApply(game(), { type: 'rotate', actor: 'p1', id: a })).toBeNull()
  })

  it('action acceptée du navigateur', () => {
    expect(parseClientAction({ type: 'rotate', id: a })).toEqual({ type: 'rotate', id: a })
  })

  it('reste pivotée quand on la déplace sur le champ de bataille', () => {
    const s = apply(game(), { type: 'rotate', actor: 'p1', id: a }, { type: 'move', actor: 'p1', id: a, to: BF, x: 10, y: 10 })
    expect(s.cards[a].rotated).toBe(true)
  })
})
