import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardName } from './apply'
import { GameHistory } from './replay'
import { canApply, isVisibleTo } from './rules'
import { parseClientAction } from './validate'
import { viewFor } from './view'
import type { GameAction, GameState, MoveAllFilter, PlayerZone } from './types'

const game = () => run(setupFor('commander', 2), start(1))
const all = (from: PlayerZone, to: PlayerZone, extra: Partial<Extract<GameAction, { type: 'moveAll' }>> = {}): GameAction =>
  ({ type: 'moveAll', actor: 'p1', from: { player: 'p1', zone: from }, to: { player: 'p1', zone: to }, ...extra })

const KENRITH = card('p1', 1)
const SOL = card('p1', 2)
const forest = (n: number) => card('p1', 3, n)
const DELVER = card('p1', 4)
const BOB_SOL = card('p2', 2)

/** p1 contrôle Kenrith, Sol Ring, deux Forêts, Delver et le Sol Ring de Bob ; deux Forêts en main. */
function board(): GameState {
  const s = place(game(), [
    ...[KENRITH, SOL, forest(1), forest(2), DELVER].map((id) => ({ id, player: 'p1', zone: 'battlefield' as const })),
    { id: BOB_SOL, player: 'p1', zone: 'battlefield' },
    ...[forest(3), forest(4)].map((id) => ({ id, player: 'p1', zone: 'hand' as const })),
  ])
  return s
}

describe('moveAll : filtres', () => {
  const moved = (filter: MoveAllFilter) => {
    const s0 = board()
    const s = applyAction(s0, all('battlefield', 'graveyard', { filter }))
    return s0.players.p1.zones.battlefield.filter((id) => !s.players.p1.zones.battlefield.includes(id))
  }

  it('chaque type, et tout sauf les terrains', () => {
    expect(moved('creature')).toEqual([KENRITH, DELVER])
    expect(moved('land')).toEqual([forest(1), forest(2)])
    expect(moved('artifact')).toEqual([SOL, BOB_SOL])
    expect(moved('nonland')).toEqual([KENRITH, SOL, DELVER, BOB_SOL])
    expect(canApply(board(), all('battlefield', 'graveyard', { filter: 'enchantment' }))).toBe('Aucune carte à déplacer')
    expect(canApply(board(), all('battlefield', 'graveyard', { filter: 'planeswalker' }))).toBe('Aucune carte à déplacer')
  })

  it('carte double : face visible ; face cachée : une créature sans autre type', () => {
    let s = applyAction(board(), { type: 'faceDown', actor: 'p1', id: SOL })
    s = applyAction(s, { type: 'flip', actor: 'p1', id: DELVER })
    const after = applyAction(s, all('battlefield', 'exile', { filter: 'creature' }))
    expect(after.players.p1.zones.exile).toEqual(expect.arrayContaining([KENRITH, SOL, DELVER]))
    expect(after.players.p1.zones.battlefield).not.toContain(SOL)
    const artifacts = applyAction(s, all('battlefield', 'exile', { filter: 'artifact' }))
    expect(artifacts.players.p1.zones.battlefield).toContain(SOL)
  })
})

describe('moveAll : destinations', () => {
  it('chaque carte chez son propriétaire hors du champ de bataille ; une ligne de journal', () => {
    const s0 = board()
    const s = applyAction(s0, all('battlefield', 'hand', { filter: 'artifact' }))
    expect(s.players.p1.zones.hand).toContain(SOL)
    expect(s.players.p2.zones.hand).toContain(BOB_SOL)
    expect(s.log.length).toBe(s0.log.length + 1)
    expect(s.log.at(-1)!.text).toBe('2 artefacts : champ de bataille → main')
  })

  it('cimetière et exil : noms au journal', () => {
    const s0 = board()
    const s = applyAction(s0, all('battlefield', 'graveyard', { filter: 'creature' }))
    expect(s.players.p1.zones.graveyard).toEqual(expect.arrayContaining([KENRITH, DELVER]))
    expect(s.log.at(-1)!.text).toBe(`2 créatures : champ de bataille → cimetière : ${cardName(s0, KENRITH)}, ${cardName(s0, DELVER)}`)
  })

  it('bibliothèque dessus ou dessous, ordre de la zone gardé, sans nom au journal', () => {
    const s0 = board()
    const { library, hand } = s0.players.p1.zones
    const top = applyAction(s0, all('hand', 'library', { position: 'top' }))
    expect(top.players.p1.zones.library).toEqual([...hand, ...library])
    expect(top.log.at(-1)!.text).toBe(`${hand.length} cartes : main → bibliothèque (dessus)`)
    const bottom = applyAction(s0, all('hand', 'library', { position: 'bottom' }))
    expect(bottom.players.p1.zones.library).toEqual([...library, ...hand])
    expect(bottom.log.at(-1)!.text).toBe(`${hand.length} cartes : main → bibliothèque (dessous)`)
  })

  it('main → bibliothèque puis mélange, avec la graine ; ni noms ni ordre', () => {
    const s0 = board()
    const s = applyAction(s0, all('hand', 'library', { shuffle: true, seed: 'g1' }))
    expect(s.players.p1.zones.hand).toEqual([])
    const { library, hand } = s0.players.p1.zones
    expect([...s.players.p1.zones.library].sort()).toEqual([...library, ...hand].sort())
    expect(s.players.p1.zones.library).not.toEqual([...hand, ...library])
    expect(applyAction(s0, all('hand', 'library', { shuffle: true, seed: 'g1' }))).toEqual(s)
    expect(s.log.at(-1)!.text).toBe(`${hand.length} cartes : main → bibliothèque (puis mélange)`)
  })

  it('champ de bataille : cartes posées en rangée', () => {
    const s0 = place(game(), [KENRITH, SOL].map((id) => ({ id, player: 'p1', zone: 'graveyard' as const })))
    const s = applyAction(s0, all('graveyard', 'battlefield'))
    expect(s.players.p1.zones.battlefield).toEqual([KENRITH, SOL])
    expect(s.cards[KENRITH].x).not.toBe(s.cards[SOL].x)
  })

  it('jetons : disparaissent en quittant le champ de bataille', () => {
    let s = applyAction(board(), { type: 'createToken', actor: 'p1', token: { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: [], image: null }, x: 10, y: 10 })
    const token = s.players.p1.zones.battlefield.at(-1)!
    s = applyAction(s, all('battlefield', 'graveyard', { filter: 'creature' }))
    expect(s.cards[token]).toBeUndefined()
    expect(s.players.p1.zones.graveyard).not.toContain(token)
  })
})

describe('moveAll : refus', () => {
  it('seulement depuis mes zones, vers une autre zone ; mélange vers la bibliothèque seulement', () => {
    const s = board()
    expect(canApply(s, { ...all('hand', 'graveyard'), from: { player: 'p2', zone: 'hand' } } as GameAction)).toBe('Tu ne peux tout déplacer que depuis tes propres zones')
    expect(canApply(s, { ...all('hand', 'graveyard'), to: { player: 'p2', zone: 'graveyard' } } as GameAction)).not.toBeNull()
    expect(canApply(s, all('hand', 'hand'))).toBe('Les cartes sont déjà dans cette zone')
    expect(canApply(s, all('hand', 'graveyard', { shuffle: true }))).toBe('Seule la bibliothèque se mélange')
    expect(canApply(s, all('exile', 'graveyard'))).toBe('Aucune carte à déplacer')
    expect(canApply(s, { ...all('hand', 'graveyard'), from: { player: 'p1', zone: 'toString' } } as unknown as GameAction)).not.toBeNull()
  })

  it('pas de filtre entre deux zones cachées (il dirait aux autres ce que contient ma main)', () => {
    expect(canApply(board(), all('hand', 'library', { filter: 'land' }))).toMatch(/révélerait/)
    expect(canApply(board(), all('library', 'hand', { filter: 'creature' }))).toMatch(/révélerait/)
    expect(canApply(board(), all('library', 'graveyard', { filter: 'land' }))).toBeNull()
  })

  it('validation du navigateur : champs connus seulement', () => {
    expect(parseClientAction({ type: 'moveAll', from: { player: 'p1', zone: 'hand' }, to: { player: 'p1', zone: 'library' }, shuffle: true, seed: 3, actor: 'p2' }))
      .toEqual({ type: 'moveAll', from: { player: 'p1', zone: 'hand' }, to: { player: 'p1', zone: 'library' }, shuffle: true })
    expect(typeof parseClientAction({ type: 'moveAll', from: { player: 'p1', zone: 'main' }, to: { player: 'p1', zone: 'library' } })).toBe('string')
    expect(typeof parseClientAction({ type: 'moveAll', from: { player: 'p1', zone: 'hand' }, to: { player: 'p1', zone: 'library' }, filter: 'instant' })).toBe('string')
    expect(parseClientAction({ type: 'mill', count: 3 })).toEqual({ type: 'mill', count: 3 })
    expect(typeof parseClientAction({ type: 'mill', count: 0 })).toBe('string')
    expect(parseClientAction({ type: 'look', target: 'p1', count: 1, bottom: true })).toEqual({ type: 'look', target: 'p1', count: 1, bottom: true })
  })
})

describe('moveAll : annulation et information cachée', () => {
  it('une seule annulation, sauf avec mélange en ligne', () => {
    const setup = setupFor('commander', 2)
    const h = new GameHistory(setup)
    h.push(start(1))
    h.push({ type: 'keep', actor: 'p1' })
    const before = h.state
    expect(h.push(all('hand', 'graveyard'))).toBeNull()
    expect(h.undo('p1')).toBe(true)
    expect(h.state).toEqual(before)
    expect(h.push(all('hand', 'library', { shuffle: true, seed: 5 }))).toBeNull()
    expect(h.canUndo('p1')).toBe(false)
  })

  it('cimetière → bibliothèque : les cartes redeviennent cachées pour l’adversaire', () => {
    const s0 = applyAction(board(), all('battlefield', 'graveyard', { filter: 'land' }))
    expect(isVisibleTo(s0, forest(1), 'p2')).toBe(true)
    const s = applyAction(s0, all('graveyard', 'library', { position: 'top' }))
    for (const id of [forest(1), forest(2)]) expect(isVisibleTo(s, id, 'p2')).toBe(false)
    expect(JSON.stringify(viewFor(s, 'p2'))).not.toContain(`"${forest(1)}"`)
  })
})

describe('mill', () => {
  it('les X du dessus au cimetière, la dernière au-dessus ; une ligne avec les noms', () => {
    const s0 = game()
    const top = s0.players.p1.zones.library.slice(0, 3)
    const s = applyAction(s0, { type: 'mill', actor: 'p1', count: 3 })
    expect(s.players.p1.zones.library).toEqual(s0.players.p1.zones.library.slice(3))
    expect(s.players.p1.zones.graveyard.slice(-3)).toEqual(top)
    expect(s.log.length).toBe(s0.log.length + 1)
    expect(s.log.at(-1)!.text).toBe(`meule 3 cartes : ${top.map((id) => cardName(s0, id)).join(', ')}`)
  })

  it('plus que la bibliothèque : tout ce qui reste ; vide : refusé', () => {
    const s0 = game()
    const n = s0.players.p1.zones.library.length
    const s = applyAction(s0, { type: 'mill', actor: 'p1', count: n + 10 })
    expect(s.players.p1.zones.library).toEqual([])
    expect(canApply(s, { type: 'mill', actor: 'p1', count: 1 })).toBe('Bibliothèque vide')
    expect(canApply(s0, { type: 'mill', actor: 'p1', count: 0 })).toBe('Nombre de cartes invalide')
  })
})

describe('look : carte du dessous', () => {
  it('pour moi seul, avec sa position ; journal « du dessous »', () => {
    const s0 = game()
    const library = s0.players.p1.zones.library
    const s = applyAction(s0, { type: 'look', actor: 'p1', target: 'p1', count: 1, bottom: true })
    const last = library.at(-1)!
    expect(isVisibleTo(s, last, 'p1')).toBe(true)
    expect(isVisibleTo(s, last, 'p2')).toBe(false)
    expect(isVisibleTo(s, library[0], 'p1')).toBe(false)
    expect(viewFor(s, 'p1').players.p1.zones.library.visible.map((v) => v.index)).toEqual([library.length - 1])
    expect(viewFor(s, 'p2').players.p1.zones.library.visible).toEqual([])
    expect(s.log.at(-2)!.text).toBe('regarde la carte du dessous de sa bibliothèque')
    expect(s.log.at(-1)).toMatchObject({ visibleTo: ['p1'] })
    const two = applyAction(s0, { type: 'look', actor: 'p1', target: 'p1', count: 2, bottom: true })
    expect(two.log.at(-2)!.text).toBe('regarde les 2 cartes du dessous de sa bibliothèque')
  })
})
