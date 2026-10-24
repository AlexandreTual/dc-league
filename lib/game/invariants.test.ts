import { describe, it, expect } from 'vitest'
import { setupFor, start } from '@/test/game-fixtures'
import { randomActions } from '@/test/game-random'
import { createRng } from './random'
import { applyAction } from './apply'
import { canApply } from './rules'
import { GameHistory, isRandomDraw, replay } from './replay'
import { createInitialState } from './setup'
import { MANA_COLORS, PLAYER_ZONES, type GameAction, type GameState } from './types'

const HOSTILE = ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf']

/** Invariants de l'état, vrais après toute suite d'actions acceptées. null si tout tient, sinon le premier écart. */
function brokenInvariant(s: GameState): string | null {
  const seen = new Map<string, string>()
  for (const [pid, p] of Object.entries(s.players)) {
    for (const zone of PLAYER_ZONES) {
      for (const id of p.zones[zone]) {
        const where = `${pid}.${zone}`
        if (seen.has(id)) return `${id} à la fois dans ${seen.get(id)} et ${where}`
        seen.set(id, where)
        if (!Object.hasOwn(s.cards, id)) return `${id} dans ${where} sans carte`
        const c = s.cards[id]
        if (c.token && zone !== 'battlefield') return `jeton ${id} dans ${where}`
        if (zone !== 'battlefield') {
          for (const key of ['ptMod', 'ptTurn', 'loyaltyMod', 'rotated', 'phasedOut', 'gained', 'lost'] as const) {
            if (c[key] !== undefined) return `${id} garde ${key} hors du champ de bataille (${where})`
          }
        }
      }
    }
    if (p.life !== Math.trunc(p.life)) return `vie de ${pid} non entière`
    if (p.poison < 0) return `poison de ${pid} négatif`
    for (const [k, v] of Object.entries(p.counters)) if (v < 0) return `marqueur ${k} de ${pid} négatif`
    for (const [k, v] of Object.entries(p.commanderDamage)) if (v < 0) return `blessures de ${k} sur ${pid} négatives`
    for (const c of MANA_COLORS) if (p.mana[c] < 0) return `mana ${c} de ${pid} négatif`
  }
  for (const [id, c] of Object.entries(s.cards)) {
    if (!seen.has(id)) return `${id} orpheline (dans aucune zone)`
    if (c.id !== id) return `${id} porte l'identifiant ${c.id}`
    if (!Object.hasOwn(s.players, c.owner)) return `${id} appartient à un joueur inconnu`
    if (!c.token && !id.startsWith(`${c.owner}:`)) return `${id} a changé de propriétaire (${c.owner})`
    if (c.counters.plus < 0 || c.counters.minus < 0 || c.counters.other < 0) return `marqueurs négatifs sur ${id}`
  }
  const alive = s.turnOrder.filter((p) => !s.players[p].eliminated)
  if (alive.length > 0) {
    if (!alive.includes(s.activePlayer)) return `joueur actif ${s.activePlayer} éliminé`
    if (s.monarch && s.players[s.monarch].eliminated) return `monarque ${s.monarch} éliminé`
    if (s.initiative && s.players[s.initiative].eliminated) return `initiative à ${s.initiative}, éliminé`
  }
  for (const [viewer, targets] of Object.entries(s.lookingAt)) {
    if (!Object.hasOwn(s.players, viewer) || !targets.every((t) => Object.hasOwn(s.players, t))) return `regard d'un joueur inconnu`
  }
  return null
}

describe('invariants du moteur sous actions aléatoires', () => {
  const playedTypes = new Set<string>()
  for (const [format, players, eliminatedSeeAll, rngSeed] of [
    ['commander', 4, false, 1], ['commander', 3, true, 2], ['duel', 2, false, 3], ['commander', 5, true, 4], ['commander', 4, true, 5], ['duel', 2, true, 17],
  ] as const) {
    it(`${format} à ${players}${eliminatedSeeAll ? ', éliminés qui voient tout' : ''} : 600 essais, état cohérent, annulation exacte`, () => {
      const rng = createRng(rngSeed)
      const next = randomActions(rng)
      const setup = setupFor(format, players, { eliminatedSeeAll })
      const history = new GameHistory(setup)
      expect(history.push(start(rngSeed))).toBeNull()
      expect(brokenInvariant(history.state)).toBeNull()

      const types = new Set<string>()
      let applied = 0
      for (let i = 0; i < 600; i++) {
        const s = history.state
        if (rng() < 0.08) {
          // Annuler : seulement sa propre dernière action, jamais un tirage, un lancer ou une élimination ; l'état redevient celui du rejeu.
          const last = history.actions.at(-1)!
          const who = rng() < 0.7 ? last.actor : s.turnOrder[Math.floor(rng() * s.turnOrder.length)]
          const expected = last.type !== 'start' && last.type !== 'roll' && last.type !== 'eliminate' && last.actor === who
            && !(last.type === 'endTurn' && last.byHost) && !isRandomDraw(last)
          expect(history.canUndo(who), `canUndo(${who}) après ${JSON.stringify(last)}`).toBe(expected)
          if (history.undo(who)) expect(history.state).toEqual(replay(setup, history.actions))
          continue
        }
        const action = next(s)
        if (history.push(action) !== null) {
          expect(history.state).toBe(s)
          continue
        }
        applied++
        types.add(action.type)
        const broken = brokenInvariant(history.state)
        expect(broken, `${broken} après ${JSON.stringify(action)}`).toBeNull()
        if (history.state.turnOrder.every((p) => history.state.players[p].eliminated)) break
      }
      expect(history.state).toEqual(replay(setup, history.actions))
      expect(applied).toBeGreaterThan(100)
      for (const t of types) playedTypes.add(t)
    })
  }

  it('les parties ci-dessus ont joué toutes les sortes d’actions', () => {
    for (const t of ['moveMany', 'giveControl', 'move', 'moveTop', 'endTurn', 'createToken', 'mulligan', 'effect', 'eliminate', 'venture', 'endLook', 'reorderTop', 'commanderDamage', 'setMonarch', 'moveAll', 'mill']) {
      expect(playedTypes, `${t} jamais joué`).toContain(t)
    }
  })

  it('une même partie rejouée donne le même état', () => {
    const rng = createRng(9)
    const next = randomActions(rng)
    const setup = setupFor('commander', 4)
    const history = new GameHistory(setup)
    history.push(start(9))
    for (let i = 0; i < 200; i++) history.push(next(history.state))
    expect(new GameHistory(setup, history.actions).state).toEqual(history.state)
  })
})

describe('identifiants hostiles', () => {
  const base = () => {
    const setup = setupFor('commander', 3)
    return [setup, applyAction(createInitialState(setup), start(1))] as const
  }
  const [, s] = base()
  const handCard = s.players.p1.zones.hand[0]
  const commander = Object.keys(s.cards).find((id) => s.cards[id].isCommander && s.cards[id].owner === 'p2')!

  /** Chaque action, avec un champ qui désigne un joueur ou une carte remplacé par `bad`. */
  const variants = (bad: string): GameAction[] => [
    { type: 'draw', actor: bad, count: 1 },
    { type: 'keep', actor: bad },
    { type: 'endTurn', actor: bad },
    { type: 'move', actor: 'p1', id: bad, to: { player: 'p1', zone: 'battlefield' } },
    { type: 'move', actor: 'p1', id: handCard, to: { player: bad, zone: 'battlefield' } },
    { type: 'moveTop', actor: 'p1', to: { player: bad, zone: 'graveyard' } },
    { type: 'moveMany', actor: 'p1', ids: [bad], zone: 'graveyard' },
    { type: 'moveMany', actor: 'p1', ids: [handCard, bad], zone: 'battlefield' },
    { type: 'giveControl', actor: 'p1', id: bad, to: 'p2' },
    { type: 'tap', actor: 'p1', id: bad },
    { type: 'flip', actor: 'p1', id: bad },
    { type: 'rotate', actor: 'p1', id: bad },
    { type: 'faceDown', actor: 'p1', id: bad },
    { type: 'phase', actor: 'p1', id: bad },
    { type: 'counter', actor: 'p1', id: bad, kind: 'plus', delta: 1 },
    { type: 'pt', actor: 'p1', id: bad, power: 1, toughness: 1 },
    { type: 'ptTurn', actor: 'p1', id: bad, power: 1, toughness: 1 },
    { type: 'effect', actor: 'p1', ids: [bad], power: 1, toughness: 1, gained: [] },
    { type: 'loyalty', actor: 'p1', id: bad, delta: 1 },
    { type: 'abilities', actor: 'p1', id: bad, gained: [], lost: [] },
    { type: 'life', actor: 'p1', target: bad, delta: -1 },
    { type: 'poison', actor: 'p1', target: bad, delta: 1 },
    { type: 'playerCounter', actor: 'p1', target: bad, name: 'Énergie', delta: 1 },
    { type: 'commanderDamage', actor: 'p1', target: bad, commander, delta: 1 },
    { type: 'commanderDamage', actor: 'p1', target: 'p1', commander: bad, delta: 1 },
    { type: 'commanderTax', actor: 'p1', id: bad, delta: 1 },
    { type: 'setMonarch', actor: 'p1', to: bad },
    { type: 'setInitiative', actor: 'p1', to: bad },
    { type: 'eliminate', actor: 'p1', target: bad },
    { type: 'reveal', actor: 'p1', ids: [bad], to: 'all' },
    { type: 'reveal', actor: 'p1', ids: 'hand', to: [bad] },
    { type: 'look', actor: 'p1', target: bad, count: 1 },
    { type: 'search', actor: 'p1', target: bad },
    { type: 'endLook', actor: 'p1', target: bad, shuffle: false },
    { type: 'reorderTop', actor: 'p1', target: bad, ids: [] },
    { type: 'mana', actor: bad, color: 'G', delta: 1 },
    { type: 'roll', actor: bad, sides: 6, count: 1, seed: 1 },
  ]

  for (const bad of HOSTILE) {
    it(`« ${bad} » est refusé partout, sans rien casser`, () => {
      for (const action of variants(bad)) {
        expect(canApply(s, action), JSON.stringify(action)).not.toBeNull()
      }
      expect(canApply(createInitialState(base()[0]), { ...start(1), first: bad } as GameAction)).not.toBeNull()
      expect(brokenInvariant(s)).toBeNull()
    })
  }

  it('un nom de marqueur hostile reste un marqueur ordinaire', () => {
    const after = applyAction(s, { type: 'playerCounter', actor: 'p1', target: 'p2', name: 'toString', delta: 2 })
    expect(after.players.p2.counters).toEqual({ toString: 2 })
    expect(brokenInvariant(after)).toBeNull()
  })
})
