import { describe, it, expect } from 'vitest'
import { setupFor } from '@/test/game-fixtures'
import { createRng } from './random'
import { applyAction } from './apply'
import { replay } from './replay'
import { isVisibleTo, zoneOf } from './rules'
import { createRoom, handleMessage, mergeCards, viewMessageFor, type CardDataMap, type ClientAction, type ClientMessage, type RoomState } from './room'
import { PLAYER_ZONES, type GameAction, type PlayerZone } from './types'

const ctx = (seed = 77, now = 0) => ({ now, seed: () => seed })
const room = (n = 3) => createRoom('t1', setupFor('commander', n), 'p1', 5)
const act = (r: RoomState, from: string | null, action: ClientAction, c = ctx()) => handleMessage(r, from, { type: 'action', action }, c)
const keepAll = (r: RoomState) => r.seats.forEach((s) => act(r, s.playerId, { type: 'keep' }))
const state = (r: RoomState) => r.history.state

describe('createRoom', () => {
  it('démarre la partie avec la graine donnée', () => {
    const r = room()
    expect(r.history.actions).toEqual([{ type: 'start', actor: 'server', seed: 5 }])
    expect(r.seats.map((s) => s.name)).toEqual(['Alex', 'Bob', 'Chloé'])
    expect(r).toMatchObject({ hostId: 'p1', finished: false, winner: null })
  })
})

describe('actions', () => {
  it('impose l’auteur et ignore la graine du navigateur', () => {
    const r = room()
    const forged = { type: 'mulligan', actor: 'p2', seed: 1 } as unknown as ClientAction
    expect(act(r, 'p1', forged, ctx(77))).toEqual({ changed: true, error: null, events: [] })
    expect(r.history.actions.at(-1)).toEqual({ type: 'mulligan', actor: 'p1', seed: 77 })
    expect(state(r).players.p2.mulligans).toBe(0)
  })

  it('graine du serveur pour shuffle et endLook', () => {
    const r = room()
    keepAll(r)
    act(r, 'p1', { type: 'shuffle' }, ctx(11))
    expect(r.history.actions.at(-1)).toEqual({ type: 'shuffle', actor: 'p1', seed: 11 })
    act(r, 'p1', { type: 'search', target: 'p2' })
    act(r, 'p1', { type: 'endLook', target: 'p2', shuffle: true }, ctx(12))
    expect(r.history.actions.at(-1)).toEqual({ type: 'endLook', actor: 'p1', target: 'p2', shuffle: true, seed: 12 })
  })

  it('refuse les spectateurs', () => {
    const r = room()
    for (const from of [null, 'p9']) {
      expect(act(r, from, { type: 'draw', count: 1 })).toEqual({ changed: false, error: 'Les spectateurs ne peuvent pas jouer', events: [] })
    }
    expect(r.history.actions).toHaveLength(1)
  })

  it('renvoie le refus du moteur sans rien changer', () => {
    const r = room()
    keepAll(r)
    const notActive = r.seats.map((s) => s.playerId).find((p) => p !== state(r).activePlayer)!
    const before = r.history.actions.length
    expect(act(r, notActive, { type: 'endTurn' })).toMatchObject({ changed: false, error: "Ce n'est pas ton tour" })
    expect(r.history.actions).toHaveLength(before)
  })

  it('annuler et abandonner', () => {
    const r = room()
    expect(handleMessage(r, 'p1', { type: 'undo' }, ctx())).toMatchObject({ changed: false, error: 'Rien à annuler' })
    act(r, 'p1', { type: 'draw', count: 1 })
    expect(handleMessage(r, 'p1', { type: 'undo' }, ctx())).toMatchObject({ changed: true, error: null })
    expect(r.history.actions).toHaveLength(1)
    expect(handleMessage(r, 'p2', { type: 'concede' }, ctx())).toMatchObject({ changed: true, error: null })
    expect(state(r).players.p2.eliminated).toBe(true)
  })

  it('reste égal au rejeu de ses actions', () => {
    const r = room()
    keepAll(r)
    act(r, 'p2', { type: 'draw', count: 2 })
    expect(state(r)).toEqual(replay(setupFor('commander', 3), r.history.actions))
  })
})

describe('viewMessageFor', () => {
  it('vue du joueur avec les données de ses cartes visibles seulement', () => {
    const r = room()
    const msg = viewMessageFor(r, 'p2', {})
    expect(msg).toMatchObject({ type: 'view', host: 'p1', finished: false, winner: null })
    expect(msg.view.me).toBe('p2')
    const handRefs = state(r).players.p2.zones.hand.map((id) => state(r).cards[id].ref)
    for (const ref of handRefs) expect(msg.cards.p2[ref!]).toBeDefined()
    expect(msg.cards.p1?.[1]).toBeDefined() // commandant d'Alex, public
    const p1Hidden = state(r).players.p1.zones.hand.map((id) => state(r).cards[id].ref!).filter((ref) => ref !== 1)
    for (const ref of p1Hidden) expect(msg.cards.p1?.[ref]).toBeUndefined()
  })

  it('n’envoie pas deux fois les mêmes données', () => {
    const r = room()
    const first = viewMessageFor(r, 'p2', {})
    expect(viewMessageFor(r, 'p2', first.cards).cards).toEqual({})
  })

  it('spectateur : vue publique', () => {
    const r = room()
    const msg = viewMessageFor(r, null, {})
    expect(msg.view.players.p1.zones.hand.every((c) => c.hidden)).toBe(true)
    expect(Object.keys(msg.cards)).toEqual(['p1', 'p2', 'p3'])
    for (const p of ['p1', 'p2', 'p3']) expect(Object.keys(msg.cards[p])).toEqual(['1'])
  })

  it('mergeCards fusionne sans modifier l’original', () => {
    const a: CardDataMap = { p1: { 1: { ref: 1 } as never } }
    const merged = mergeCards(a, { p1: { 2: { ref: 2 } as never }, p2: { 1: { ref: 1 } as never } })
    expect(Object.keys(merged.p1)).toEqual(['1', '2'])
    expect(Object.keys(merged.p2)).toEqual(['1'])
    expect(Object.keys(a.p1)).toEqual(['1'])
  })
})

describe('anti-fuite', () => {
  it('200 messages aléatoires : aucune donnée de carte invisible envoyée', () => {
    const rng = createRng(42)
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]
    const r = room(4)
    const ids = r.seats.map((s) => s.playerId)
    keepAll(r)
    const viewers: (string | null)[] = [...ids, null]
    const sent = new Map<string | null, CardDataMap>(viewers.map((v) => [v, {}]))

    const randomMessage = (): ClientMessage => {
      const s = state(r)
      const actor = pick(ids)
      const allCards = Object.keys(s.cards)
      switch (pick(['draw', 'move', 'move', 'move', 'look', 'endLook', 'reveal', 'faceDown', 'endTurn', 'search', 'undo', 'shuffle'])) {
        case 'draw': return { type: 'action', action: { type: 'draw', count: 1 } }
        case 'move': {
          const id = pick(allCards)
          const zone: PlayerZone = pick(PLAYER_ZONES)
          return { type: 'action', action: { type: 'move', id, to: { player: rng() < 0.5 ? actor : s.cards[id].owner, zone }, faceDown: rng() < 0.2 } }
        }
        case 'look': return { type: 'action', action: { type: 'look', target: pick(ids), count: 1 + Math.floor(rng() * 3) } }
        case 'search': return { type: 'action', action: { type: 'search', target: pick(ids) } }
        case 'endLook': return { type: 'action', action: { type: 'endLook', target: pick(ids), shuffle: rng() < 0.5 } }
        case 'reveal': {
          const hand = s.players[actor].zones.hand
          return { type: 'action', action: { type: 'reveal', ids: hand.length ? [pick(hand)] : 'hand', to: rng() < 0.3 ? 'all' : [pick(ids)] } }
        }
        case 'faceDown': return { type: 'action', action: { type: 'faceDown', id: pick(allCards) } }
        case 'endTurn': return { type: 'action', action: { type: 'endTurn' } }
        case 'shuffle': return { type: 'action', action: { type: 'shuffle' } }
        default: return { type: 'undo' }
      }
    }

    let changed = 0
    for (let i = 0; i < 200; i++) {
      const from = pick(ids)
      const msg = randomMessage()
      if (!handleMessage(r, from, msg, { now: i, seed: () => Math.floor(rng() * 1e9) }).changed) continue
      changed++
      const s = state(r)
      for (const viewer of viewers) {
        const out = viewMessageFor(r, viewer, sent.get(viewer)!)
        sent.set(viewer, mergeCards(sent.get(viewer)!, out.cards))
        for (const [owner, refs] of Object.entries(out.cards)) {
          for (const ref of Object.keys(refs).map(Number)) {
            const shown = Object.values(s.cards).some(
              (c) => c.owner === owner && c.ref === ref && zoneOf(s, c.id) !== null && isVisibleTo(s, c.id, viewer ?? ''),
            )
            expect(shown, `${owner}#${ref} envoyé à ${viewer} après ${JSON.stringify(msg)}`).toBe(true)
          }
        }
      }
    }
    expect(changed).toBeGreaterThan(80)
  })
})

// Garde le lien avec le moteur : une action jouée par la table équivaut à applyAction.
it('une action de la table équivaut à applyAction', () => {
  const r = room(2)
  const before = state(r)
  act(r, 'p1', { type: 'draw', count: 1 })
  expect(state(r)).toEqual(applyAction(before, { type: 'draw', actor: 'p1', count: 1 } as GameAction))
})
