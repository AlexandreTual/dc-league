import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { canApply } from './rules'
import { parseClientAction } from './validate'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const last = (s: GameState) => s.log[s.log.length - 1].text
const game = () => run(setupFor('commander', 2), start(1))

/** Applique les actions en vérifiant qu'elles sont permises. */
function play(s: GameState, ...actions: GameAction[]): GameState {
  for (const a of actions) {
    expect(canApply(s, a)).toBeNull()
    s = applyAction(s, a)
  }
  return s
}

describe('explorer le donjon', () => {
  it('sans donjon : il faut en choisir un, jamais Les Souterrains', () => {
    const s = game()
    expect(canApply(s, { type: 'venture', actor: 'p1' })).toBe('Choisis un donjon')
    expect(canApply(s, { type: 'venture', actor: 'p1', dungeon: 'undercity' })).toBe("On n'entre dans Les Souterrains qu'avec l'initiative")
  })

  it('entre dans la première salle, puis avance ; une ligne de journal par déplacement', () => {
    let s = play(game(), { type: 'venture', actor: 'p1', dungeon: 'phandelver' })
    expect(s.players.p1.dungeon).toEqual({ id: 'phandelver', room: 'cave' })
    expect(last(s)).toBe('entre dans la Mine oubliée de Phancreux : Entrée du souterrain — Regard 1.')
    const lines = s.log.length
    expect(canApply(s, { type: 'venture', actor: 'p1' })).toBe('Choisis la salle suivante')
    expect(canApply(s, { type: 'venture', actor: 'p1', room: 'temple' })).toBe("Cette salle n'est pas accessible d'ici")
    expect(canApply(s, { type: 'venture', actor: 'p1', dungeon: 'madMage', room: 'goblinLair' })).toBe('Tu as déjà un donjon en cours')
    s = play(s, { type: 'venture', actor: 'p1', room: 'mineTunnels' })
    expect(s.players.p1.dungeon).toEqual({ id: 'phandelver', room: 'mineTunnels' })
    expect(s.log.length).toBe(lines + 1)
    expect(last(s)).toBe('avance dans la Mine oubliée de Phancreux : Tunnels de la mine — Créez un jeton Trésor.')
    expect(s.players.p2.dungeon).toBeUndefined()
  })

  it('une seule salle suivante : pas besoin de la nommer', () => {
    const s = play(game(), { type: 'venture', actor: 'p1', dungeon: 'annihilation' }, { type: 'venture', actor: 'p1', room: 'veils' }, { type: 'venture', actor: 'p1' })
    expect(s.players.p1.dungeon?.room).toBe('sandfall')
  })

  it('dernière salle : donjon terminé, compté ; la fois suivante on en recommence un', () => {
    let s = play(game(),
      { type: 'venture', actor: 'p1', dungeon: 'annihilation' },
      { type: 'venture', actor: 'p1', room: 'oubliette' },
      { type: 'venture', actor: 'p1' })
    expect(s.players.p1.dungeon).toEqual({ id: 'annihilation', room: 'cradle' })
    expect(s.players.p1.dungeonsDone).toBe(1)
    expect(last(s)).toMatch(/: Berceau du dieu de la Mort — .*\. Donjon terminé \(1 au total\)\.$/)
    expect(canApply(s, { type: 'venture', actor: 'p1' })).toBe('Choisis un donjon')
    s = play(s, { type: 'venture', actor: 'p1', dungeon: 'phandelver' })
    expect(s.players.p1.dungeon).toEqual({ id: 'phandelver', room: 'cave' })
    expect(s.players.p1.dungeonsDone).toBe(1)
  })

  it('Les Souterrains : sans donjon on y entre ; avec un autre donjon commencé on avance dans celui-là', () => {
    let s = play(game(), { type: 'venture', actor: 'p1', undercity: true })
    expect(s.players.p1.dungeon).toEqual({ id: 'undercity', room: 'secret' })
    expect(last(s)).toMatch(/^entre dans Les Souterrains : Entrée secrète — Cherchez/)
    s = play(s, { type: 'venture', actor: 'p2', dungeon: 'madMage' }, { type: 'venture', actor: 'p2', undercity: true })
    expect(s.players.p2.dungeon).toEqual({ id: 'madMage', room: 'level' })
  })

  it('les autres joueurs ne peuvent pas explorer pour moi ; un joueur éliminé ne peut plus', () => {
    const s = play(game(), { type: 'eliminate', actor: 'p2', target: 'p2' })
    expect(canApply(s, { type: 'venture', actor: 'p2', dungeon: 'phandelver' })).toBe('Tu es éliminé')
  })
})

describe('initiative : exploration des Souterrains proposée', () => {
  it('prendre l’initiative la propose ; explorer Les Souterrains la retire', () => {
    let s = play(game(), { type: 'setInitiative', actor: 'p2', to: 'p1' })
    expect(s.ventureOffers).toEqual(['p1'])
    expect(s.players.p1.dungeon).toBeUndefined()
    s = play(s, { type: 'venture', actor: 'p1', undercity: true })
    expect(s.ventureOffers).toEqual([])
  })

  it('« Plus tard » la retire ; refusé sans proposition', () => {
    let s = play(game(), { type: 'setInitiative', actor: 'p1', to: 'p1' })
    s = play(s, { type: 'skipVenture', actor: 'p1' })
    expect(s.ventureOffers).toEqual([])
    expect(canApply(s, { type: 'skipVenture', actor: 'p1' })).toBe('Aucune exploration proposée')
  })

  it('au début du tour du joueur qui a l’initiative ; une seule proposition à la fois', () => {
    let s = game()
    const other = s.turnOrder[1]
    s = play(s, { type: 'setInitiative', actor: s.activePlayer, to: other })
    s = play(s, { type: 'endTurn', actor: s.activePlayer })
    expect(s.activePlayer).toBe(other)
    expect(s.ventureOffers).toEqual([other])
    s = play(s, { type: 'endTurn', actor: other })
    expect(s.ventureOffers).toEqual([other])
  })

  it('perdre l’initiative ne la propose à personne ; explorer le donjon (sans l’initiative) ne retire rien', () => {
    let s = play(game(), { type: 'setInitiative', actor: 'p1', to: 'p1' }, { type: 'setInitiative', actor: 'p1', to: null })
    expect(s.ventureOffers).toEqual(['p1'])
    s = play(s, { type: 'venture', actor: 'p1', dungeon: 'phandelver' })
    expect(s.ventureOffers).toEqual(['p1'])
  })
})

describe('joueur éliminé : monarque et initiative (règles 724.4 et 725.4)', () => {
  const game3 = () => run(setupFor('commander', 3), start(1))
  /** Joueurs dans l'ordre du tour, à partir du joueur actif. */
  const seats = (s: GameState) => {
    const i = s.turnOrder.indexOf(s.activePlayer)
    return [...s.turnOrder.slice(i), ...s.turnOrder.slice(0, i)]
  }

  it('hors de son tour : le joueur actif les prend et l’exploration lui est proposée ; l’éliminé n’a plus de proposition', () => {
    let s = game3()
    const [a, b] = seats(s)
    s = play(s, { type: 'setMonarch', actor: b, to: b }, { type: 'setInitiative', actor: b, to: b })
    expect(s.ventureOffers).toEqual([b])
    s = play(s, { type: 'eliminate', actor: b, target: b })
    expect(s.activePlayer).toBe(a)
    expect(s.monarch).toBe(a)
    expect(s.initiative).toBe(a)
    expect(s.ventureOffers).toEqual([a])
    expect(s.log.slice(-2).map((l) => l.text)).toEqual([
      `${s.players[a].name} devient le monarque`,
      `${s.players[a].name} prend l’initiative`,
    ])
  })

  it('pendant son tour : le joueur suivant les prend', () => {
    let s = game3()
    const [a, b] = seats(s)
    s = play(s, { type: 'setMonarch', actor: a, to: a }, { type: 'setInitiative', actor: a, to: a })
    s = play(s, { type: 'eliminate', actor: a, target: a })
    expect(s.activePlayer).toBe(b)
    expect(s.monarch).toBe(b)
    expect(s.initiative).toBe(b)
    expect(s.ventureOffers).toEqual([b])
  })

  it('un autre détenteur garde la couronne et l’initiative', () => {
    let s = game3()
    const [a, b, c] = seats(s)
    s = play(s, { type: 'setMonarch', actor: c, to: c }, { type: 'setInitiative', actor: c, to: c })
    s = play(s, { type: 'eliminate', actor: a, target: a })
    expect(s.activePlayer).toBe(b)
    expect(s.monarch).toBe(c)
    expect(s.initiative).toBe(c)
    expect(s.ventureOffers).toEqual([c])
  })
})

describe('vue et validation', () => {
  it('tout est public : donjon, salle, donjons terminés et propositions', () => {
    const s = play(game(), { type: 'venture', actor: 'p1', dungeon: 'phandelver' }, { type: 'setInitiative', actor: 'p1', to: 'p2' })
    const v = viewFor(s, 'p2')
    expect(v.players.p1.dungeon).toEqual({ id: 'phandelver', room: 'cave' })
    expect(v.ventureOffers).toEqual(['p2'])
    expect(viewFor(game(), 'p1').players.p1.dungeon).toBeUndefined()
  })

  it('parseClientAction : champs prévus seulement, donjon connu', () => {
    expect(parseClientAction({ type: 'venture', dungeon: 'madMage', extra: 1 })).toEqual({ type: 'venture', dungeon: 'madMage' })
    expect(parseClientAction({ type: 'venture', undercity: true, room: 'forge' })).toEqual({ type: 'venture', undercity: true, room: 'forge' })
    expect(parseClientAction({ type: 'venture', dungeon: 'toString' })).toBe('Action invalide : dungeon')
    expect(parseClientAction({ type: 'venture', room: 'x'.repeat(100) })).toBe('Action invalide : room')
    expect(parseClientAction({ type: 'skipVenture' })).toEqual({ type: 'skipVenture' })
  })
})
