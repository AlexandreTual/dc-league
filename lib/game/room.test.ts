import { describe, it, expect } from 'vitest'
import { setupFor } from '@/test/game-fixtures'
import { createRng } from './random'
import { applyAction } from './apply'
import { replay } from './replay'
import { isVisibleTo, zoneOf } from './rules'
import { createRoom, handleConnect, handleDisconnect, handleMessage, mergeCards, onlinePlayers, viewMessageFor, type CardDataMap, type ClientAction, type ClientMessage, type RoomState } from './room'
import { PLAYER_ZONES, type GameAction, type PlayerZone } from './types'

const ctx = (seed = 77, now = 0) => ({ now, seed: () => seed })
/** Graines successives g0, g1… : l'ordre du tour puis une par joueur. */
const seeds = () => { let n = 0; return () => `g${n++}` }
const room = (n = 3, now = 0) => createRoom('t1', setupFor('commander', n), 'p1', seeds(), now)
const act = (r: RoomState, from: string | null, action: ClientAction, c = ctx()) => handleMessage(r, from, { type: 'action', action }, c)
const keepAll = (r: RoomState) => r.seats.forEach((s) => act(r, s.playerId, { type: 'keep' }))
const state = (r: RoomState) => r.history.state

describe('createRoom', () => {
  it('démarre la partie avec une graine par joueur, tirées par le serveur', () => {
    const r = room()
    expect(r.history.actions).toEqual([{ type: 'start', actor: 'server', seed: 'g0', seeds: { p1: 'g1', p2: 'g2', p3: 'g3' } }])
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

const MIN = 60_000
const host = (r: RoomState, from: string, op: 'passTurn' | 'eliminate' | 'close', target = '', now = 0) =>
  handleMessage(r, from, (op === 'close' ? { type: 'host', op } : { type: 'host', op, target }) as ClientMessage, ctx(1, now))

describe('présence', () => {
  it('un joueur dans deux onglets reste en ligne si un onglet se ferme', () => {
    const r = room()
    handleConnect(r, 'p1', 0)
    handleConnect(r, 'p1', 0)
    handleDisconnect(r, 'p1', 10)
    expect(onlinePlayers(r)).toEqual(['p1'])
    handleDisconnect(r, 'p1', 20)
    expect(onlinePlayers(r)).toEqual([])
  })

  it('un spectateur ne compte pas', () => {
    const r = room()
    expect(handleConnect(r, null, 0).changed).toBe(false)
    expect(onlinePlayers(r)).toEqual([])
  })
})

describe('transmission du rôle d’hôte', () => {
  it('après 5 minutes d’absence, au premier joueur connecté suivant ; sans retour automatique', () => {
    const r = room(4)
    for (const p of ['p1', 'p3', 'p4']) handleConnect(r, p, 0)
    handleDisconnect(r, 'p1', 1000)
    expect(act(r, 'p3', { type: 'draw', count: 1 }, ctx(1, 1000 + 5 * MIN - 1)).events).toEqual([])
    expect(r.hostId).toBe('p1')
    const out = act(r, 'p3', { type: 'draw', count: 1 }, ctx(1, 1000 + 5 * MIN + 1))
    expect(out.events).toEqual([{ type: 'hostChanged', hostId: 'p3' }]) // p2 n'est pas connecté
    expect(r.hostId).toBe('p3')
    handleConnect(r, 'p1', 1000 + 6 * MIN)
    expect(r.hostId).toBe('p3')
  })

  it('un hôte jamais connecté compte comme absent depuis la création', () => {
    const r = room(3, 0)
    expect(handleConnect(r, 'p2', 5 * MIN + 1).events).toEqual([{ type: 'hostChanged', hostId: 'p2' }])
  })
})

describe('pouvoirs de l’hôte', () => {
  it('passe le tour du joueur actif, refuse un autre et les non-hôtes', () => {
    const r = room()
    keepAll(r)
    const active = state(r).activePlayer
    const other = r.seats.map((s) => s.playerId).find((p) => p !== active)!
    expect(host(r, 'p1', 'passTurn', other)).toMatchObject({ changed: false, error: "Ce n'est pas son tour" })
    const nonHost = r.seats.map((s) => s.playerId).find((p) => p !== 'p1')!
    expect(host(r, nonHost, 'passTurn', active)).toMatchObject({ changed: false, error: "Seul l'hôte peut faire ça" })
    expect(host(r, 'p1', 'passTurn', active)).toMatchObject({ changed: true })
    expect(state(r).activePlayer).not.toBe(active)
  })

  it('élimine un joueur', () => {
    const r = room()
    host(r, 'p1', 'eliminate', 'p2')
    expect(state(r).players.p2.eliminated).toBe(true)
  })

  it('clore la partie : sans vainqueur, puis plus rien n’est accepté', () => {
    const r = room()
    expect(host(r, 'p1', 'close')).toEqual({ changed: true, error: null, events: [{ type: 'finished', winner: null }] })
    expect(r).toMatchObject({ finished: true, winner: null })
    expect(act(r, 'p2', { type: 'draw', count: 1 })).toMatchObject({ changed: false, error: 'La partie est terminée' })
  })
})

describe('fin de partie', () => {
  it('le dernier joueur non éliminé gagne', () => {
    const r = room()
    handleMessage(r, 'p2', { type: 'concede' }, ctx())
    const out = host(r, 'p1', 'eliminate', 'p3')
    expect(out.events).toEqual([{ type: 'finished', winner: 'p1' }])
    expect(r).toMatchObject({ finished: true, winner: 'p1' })
    expect(viewMessageFor(r, 'p1', {})).toMatchObject({ finished: true, winner: 'p1' })
    expect(handleMessage(r, 'p1', { type: 'undo' }, ctx())).toMatchObject({ changed: false, error: 'La partie est terminée' })
  })

  it('jamais de fin automatique en solo', () => {
    const r = room(1)
    expect(handleMessage(r, 'p1', { type: 'concede' }, ctx()).events).toEqual([])
    expect(r.finished).toBe(false)
  })
})

describe('passage de tour par l’hôte au journal', () => {
  it('commande hôte : mention ; action du joueur avec byHost : ignorée', () => {
    const r = room()
    keepAll(r)
    const active = state(r).activePlayer
    if (active === 'p1') act(r, 'p1', { type: 'endTurn' })
    const target = state(r).activePlayer
    handleMessage(r, 'p1', { type: 'host', op: 'passTurn', target }, ctx())
    expect(state(r).log.at(-1)?.text).toMatch(/\(passé par l’hôte\)$/)
    const next = state(r).activePlayer
    act(r, next, { type: 'endTurn', byHost: true } as ClientAction)
    expect(state(r).log.at(-1)?.text).not.toMatch(/passé par l’hôte/)
  })
})
