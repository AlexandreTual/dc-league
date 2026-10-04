import { describe, it, expect } from 'vitest'
import { card, place, setupFor } from '@/test/game-fixtures'
import { createInitialState } from './setup'
import { canApply, controllerOf, isVisibleTo, zoneOf } from './rules'
import type { GameAction, GameState } from './types'

const sol = (p: string) => card(p, 2)
const kenrith = (p: string) => card(p, 1)

/** 4 joueurs, partie démarrée : Sol Ring de p2 au cimetière, Sol Ring de p1 en main, Forêt de p1 sur le champ de bataille de p1. */
function base(format: 'commander' | 'duel' = 'commander'): GameState {
  return place(createInitialState(setupFor(format, format === 'duel' ? 2 : 4)), [
    { id: sol('p2'), player: 'p2', zone: 'graveyard' },
    { id: sol('p1'), player: 'p1', zone: 'hand' },
    { id: card('p1', 3), player: 'p1', zone: 'battlefield' },
  ])
}

const ok = (s: GameState, a: GameAction) => expect(canApply(s, a)).toBeNull()
const ko = (s: GameState, a: GameAction, msg?: string) =>
  msg ? expect(canApply(s, a)).toBe(msg) : expect(canApply(s, a)).not.toBeNull()

describe('lecture', () => {
  it('zoneOf, controllerOf', () => {
    let s = base()
    expect(zoneOf(s, sol('p2'))).toEqual({ player: 'p2', zone: 'graveyard' })
    s = place(s, [{ id: sol('p2'), player: 'p1', zone: 'battlefield' }])
    expect(controllerOf(s, sol('p2'))).toBe('p1')
    expect(controllerOf(s, sol('p1'))).toBe('p1')
  })

  it('isVisibleTo selon la zone', () => {
    const s = base()
    expect(isVisibleTo(s, sol('p1'), 'p1')).toBe(true)
    expect(isVisibleTo(s, sol('p1'), 'p2')).toBe(false)
    expect(isVisibleTo(s, sol('p2'), 'p3')).toBe(true)
    expect(isVisibleTo(s, card('p1', 3, 2), 'p1')).toBe(false)
  })
})

describe('généralités', () => {
  it('refuse un joueur inconnu, un joueur éliminé et une partie non démarrée', () => {
    const s = base()
    ko(s, { type: 'draw', actor: 'zz', count: 1 })
    const dead = { ...s, players: { ...s.players, p3: { ...s.players.p3, eliminated: true } } }
    ko(dead, { type: 'draw', actor: 'p3', count: 1 }, 'Tu es éliminé')
    ko(createInitialState(setupFor('commander', 2)), { type: 'draw', actor: 'p1', count: 1 }, "La partie n'a pas commencé")
  })

  it('start : serveur uniquement, une seule fois', () => {
    const fresh = createInitialState(setupFor('commander', 2))
    ok(fresh, { type: 'start', actor: 'server', seed: 1 })
    ko(fresh, { type: 'start', actor: 'p1' as 'server', seed: 1 })
    ko(base(), { type: 'start', actor: 'server', seed: 1 })
  })

  it('mulligan et keep avant d’avoir gardé', () => {
    const s = base()
    ok(s, { type: 'mulligan', actor: 'p1', seed: 1 })
    const kept = { ...s, players: { ...s.players, p1: { ...s.players.p1, kept: true } } }
    ko(kept, { type: 'mulligan', actor: 'p1', seed: 1 })
    ko(kept, { type: 'keep', actor: 'p1' })
  })

  it('endTurn : joueur actif seulement', () => {
    ok(base(), { type: 'endTurn', actor: 'p1' })
    ko(base(), { type: 'endTurn', actor: 'p2' }, "Ce n'est pas ton tour")
  })
})

describe('move', () => {
  it('réanimer depuis le cimetière d’un adversaire sur son champ de bataille', () => {
    ok(base(), { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p1', zone: 'battlefield' } })
  })

  it('renvoyer une carte publique chez son propriétaire', () => {
    ok(base(), { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p2', zone: 'exile' } })
  })

  it('refuser de mettre la carte d’un autre chez un troisième joueur', () => {
    ko(base(), { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p3', zone: 'graveyard' } },
      'Tu ne peux déplacer cette carte que sur ton champ de bataille ou chez son propriétaire')
  })

  it('refuser de prendre une carte cachée d’un autre', () => {
    ko(base(), { type: 'move', actor: 'p2', id: sol('p1'), to: { player: 'p2', zone: 'battlefield' } }, 'Cette carte est cachée')
    ko(base(), { type: 'move', actor: 'p2', id: card('p1', 3, 2), to: { player: 'p2', zone: 'battlefield' } }, 'Cette carte est cachée')
  })

  it('accepter une carte de la bibliothèque adverse regardée', () => {
    const s = base()
    const top = s.players.p2.zones.library[0]
    const looked: GameState = {
      ...s,
      cards: { ...s.cards, [top]: { ...s.cards[top], knownBy: ['p1'] } },
      lookingAt: { p1: ['p2'] },
    }
    ok(looked, { type: 'move', actor: 'p1', id: top, to: { player: 'p1', zone: 'battlefield' } })
  })

  it('le propriétaire déplace ses cartes partout chez lui', () => {
    ok(base(), { type: 'move', actor: 'p1', id: sol('p1'), to: { player: 'p1', zone: 'library' }, position: 'bottom' })
    ok(base(), { type: 'move', actor: 'p1', id: card('p1', 3, 2), to: { player: 'p1', zone: 'hand' } })
  })

  it('refuser une carte inconnue', () => {
    ko(base(), { type: 'move', actor: 'p1', id: 'zz', to: { player: 'p1', zone: 'hand' } })
  })
})

describe('contrôle et cartes', () => {
  const stolen = () => place(base(), [{ id: sol('p2'), player: 'p1', zone: 'battlefield' }])

  it('giveControl par le contrôleur seulement', () => {
    ok(stolen(), { type: 'giveControl', actor: 'p1', id: sol('p2'), to: 'p3' })
    ko(stolen(), { type: 'giveControl', actor: 'p2', id: sol('p2'), to: 'p3' })
    ko(base(), { type: 'giveControl', actor: 'p1', id: sol('p1'), to: 'p3' })
  })

  it('tap et counter par n’importe qui sur un champ de bataille', () => {
    ok(base(), { type: 'tap', actor: 'p3', id: card('p1', 3) })
    ok(base(), { type: 'counter', actor: 'p3', id: card('p1', 3), kind: 'plus', delta: 1 })
    ko(base(), { type: 'tap', actor: 'p3', id: sol('p2') })
  })

  it('flip et faceDown par le contrôleur', () => {
    ok(base(), { type: 'faceDown', actor: 'p1', id: card('p1', 3) })
    ko(base(), { type: 'faceDown', actor: 'p2', id: card('p1', 3) })
  })

  it('commanderTax par le propriétaire du commandant', () => {
    ok(base(), { type: 'commanderTax', actor: 'p1', id: kenrith('p1'), delta: 1 })
    ko(base(), { type: 'commanderTax', actor: 'p2', id: kenrith('p1'), delta: 1 })
  })
})

describe('compteurs de joueur', () => {
  it('life, poison, monarque : cible valide', () => {
    ok(base(), { type: 'life', actor: 'p2', target: 'p1', delta: -3 })
    ko(base(), { type: 'life', actor: 'p2', target: 'zz', delta: -3 })
    ok(base(), { type: 'setMonarch', actor: 'p2', to: 'p4' })
    ok(base(), { type: 'setInitiative', actor: 'p2', to: null })
  })

  it('commanderDamage : commandant d’un autre joueur, et jamais en duel', () => {
    ok(base(), { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: kenrith('p2'), delta: 5 })
    ko(base(), { type: 'commanderDamage', actor: 'p1', target: 'p1', commander: kenrith('p1'), delta: 5 })
    ko(base(), { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: sol('p2'), delta: 5 })
    ko(base('duel'), { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: kenrith('p2'), delta: 5 },
      'Pas de blessures de commandant en Duel Commander')
  })

  it('eliminate : joueur pas encore éliminé', () => {
    ok(base(), { type: 'eliminate', actor: 'p2', target: 'p3' })
    const dead = base()
    dead.players.p3 = { ...dead.players.p3, eliminated: true }
    ko(dead, { type: 'eliminate', actor: 'p2', target: 'p3' })
  })
})

describe('informations cachées', () => {
  it('reveal : ses propres cartes en main', () => {
    ok(base(), { type: 'reveal', actor: 'p1', ids: [sol('p1')], to: ['p3'] })
    ok(base(), { type: 'reveal', actor: 'p1', ids: 'hand', to: 'all' })
    ko(base(), { type: 'reveal', actor: 'p2', ids: [sol('p1')], to: 'all' })
    ko(base(), { type: 'reveal', actor: 'p1', ids: [sol('p1')], to: ['zz'] })
  })

  it('look, search, endLook', () => {
    ok(base(), { type: 'look', actor: 'p1', target: 'p2', count: 3 })
    ko(base(), { type: 'look', actor: 'p1', target: 'p2', count: 0 })
    ok(base(), { type: 'search', actor: 'p1', target: 'p1' })
    ko(base(), { type: 'endLook', actor: 'p1', target: 'p2', shuffle: false })
    ok({ ...base(), lookingAt: { p1: ['p2'] } }, { type: 'endLook', actor: 'p1', target: 'p2', shuffle: false })
  })
})
