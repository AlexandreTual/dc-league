import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardName } from './apply'
import { shuffle } from './random'
import { canApply } from './rules'
import type { GameAction, GameState } from './types'

const game = () => run(setupFor('commander', 2), start(1))
const many = (ids: string[], zone: Extract<GameAction, { type: 'moveMany' }>['zone'], extra: Partial<Extract<GameAction, { type: 'moveMany' }>> = {}): GameAction =>
  ({ type: 'moveMany', actor: 'p1', ids, zone, ...extra })

/** Partie où p1 a Kenrith, Sol Ring et une Forêt en jeu, et deux Forêts en main. */
function board(): { s: GameState; field: string[]; hand: string[] } {
  const field = [card('p1', 1), card('p1', 2), card('p1', 3, 1)]
  const hand = [card('p1', 3, 2), card('p1', 3, 3)]
  const s = place(game(), [
    ...field.map((id) => ({ id, player: 'p1', zone: 'battlefield' as const })),
    ...hand.map((id) => ({ id, player: 'p1', zone: 'hand' as const })),
  ])
  return { s, field, hand }
}

describe('moveMany', () => {
  it('range plusieurs permanents au cimetière : la première carte choisie finit au-dessus, une seule ligne de journal', () => {
    const { s: s0, field } = board()
    const tapped = applyAction(s0, { type: 'tap', actor: 'p1', id: field[0] })
    const s = applyAction(tapped, many([field[1], field[0], field[2]], 'graveyard'))
    expect(s.players.p1.zones.battlefield).toEqual([])
    expect(s.players.p1.zones.graveyard.slice(-3)).toEqual([field[2], field[0], field[1]])
    expect(s.cards[field[0]].tapped).toBe(false)
    expect(s.log.length).toBe(tapped.log.length + 1)
    expect(s.log.at(-1)).toMatchObject({ actor: 'p1', visibleTo: 'all' })
    expect(s.log.at(-1)!.text).toBe(`3 cartes : champ de bataille → cimetière : ${[field[1], field[0], field[2]].map((id) => cardName(s0, id)).join(', ')}`)
  })

  it('bibliothèque dessus ou dessous, dans l’ordre choisi ; journal sans nom de carte', () => {
    const { s: s0, field, hand } = board()
    const library = s0.players.p1.zones.library
    const top = applyAction(s0, many([field[0], field[1]], 'library', { position: 'top' }))
    expect(top.players.p1.zones.library).toEqual([field[0], field[1], ...library])
    expect(top.log.at(-1)!.text).toBe('2 cartes : champ de bataille → bibliothèque (dessus)')
    expect(top.log.at(-1)!.text).not.toContain(cardName(s0, field[0]))
    const bottom = applyAction(s0, many([hand[1], hand[0]], 'library', { position: 'bottom' }))
    expect(bottom.players.p1.zones.library).toEqual([...library, hand[1], hand[0]])
    expect(bottom.log.at(-1)!.text).toBe('2 cartes : main → bibliothèque (dessous)')
    // Sans position : dessus.
    expect(applyAction(s0, many(hand, 'library')).players.p1.zones.library.slice(0, 2)).toEqual(hand)
  })

  it('ordre aléatoire : tiré avec la graine, rien du tirage dans le journal', () => {
    const { s: s0, field } = board()
    const s = applyAction(s0, many(field, 'library', { position: 'top', random: true, seed: 'abc' }))
    expect(s.players.p1.zones.library.slice(0, 3)).toEqual(shuffle(field, 'abc'))
    expect(s.log.at(-1)!.text).toBe('3 cartes : champ de bataille → bibliothèque (dessus, ordre aléatoire)')
    const again = applyAction(s0, many(field, 'library', { position: 'top', random: true, seed: 'abc' }))
    expect(again.players.p1.zones.library).toEqual(s.players.p1.zones.library)
  })

  it('une carte d’un autre joueur que je contrôle retourne chez son propriétaire ; un jeton disparaît', () => {
    const stolen = card('p2', 2)
    let s0 = place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'battlefield' }, { id: stolen, player: 'p1', zone: 'battlefield' }])
    s0 = applyAction(s0, { type: 'createToken', actor: 'p1', token: { name: 'Soldat', typeLine: 'Token Creature', power: '1', toughness: '1', colors: [], image: null }, x: 10, y: 10 })
    const token = s0.players.p1.zones.battlefield.at(-1)!
    const s = applyAction(s0, many([card('p1', 1), stolen, token], 'graveyard'))
    expect(s.players.p2.zones.graveyard).toContain(stolen)
    expect(s.players.p1.zones.graveyard).toContain(card('p1', 1))
    expect(s.cards[token]).toBeUndefined()
    expect(s.players.p1.zones.battlefield).toEqual([])
  })

  it('déplacement sur le champ de bataille : chaque carte à sa place, ordre d’affichage gardé', () => {
    const { s: s0, field } = board()
    const s = applyAction(s0, many([field[0], field[2]], 'battlefield', { places: [{ x: 20, y: 30 }, { x: 120, y: 40 }] }))
    expect(s.cards[field[0]]).toMatchObject({ x: 20, y: 30 })
    expect(s.cards[field[2]]).toMatchObject({ x: 100, y: 40 })
    expect(s.players.p1.zones.battlefield).toEqual([field[1], field[0], field[2]])
  })

  it('de la main au champ de bataille : terrains joués comptés', () => {
    const { s: s0, hand } = board()
    const s = applyAction(s0, many(hand, 'battlefield', { places: [{ x: 40, y: 50 }, { x: 46, y: 50 }] }))
    expect(s.players.p1.zones.battlefield.slice(-2)).toEqual(hand)
    expect(s.players.p1.stats.landsPlayed).toBe(s0.players.p1.stats.landsPlayed + 2)
    expect(s.log.at(-1)!.text).toContain('2 cartes : main → champ de bataille')
  })

  it('refuse une liste vide ou en double, des zones différentes, une carte cachée, des positions en trop', () => {
    const { s, field, hand } = board()
    expect(canApply(s, many([], 'graveyard'))).toBe('Nombre de cartes invalide')
    expect(canApply(s, many([field[0], field[0]], 'graveyard'))).toBe('Nombre de cartes invalide')
    expect(canApply(s, many([field[0], hand[0]], 'graveyard'))).toBe('Les cartes doivent venir de la même zone')
    expect(canApply(s, many([s.players.p2.zones.hand[0], s.players.p2.zones.hand[1]], 'graveyard'))).toBe('Cette carte est cachée')
    expect(canApply(s, many(['inconnue'], 'graveyard'))).toBe('Carte introuvable')
    expect(canApply(s, many(field, 'battlefield', { places: [{ x: 1, y: 1 }] }))).toBe('Positions invalides')
    expect(canApply(s, many(field, 'graveyard', { places: field.map(() => ({ x: 1, y: 1 })) }))).toBe('Positions invalides')
    expect(applyAction(s, many([field[0], hand[0]], 'graveyard'))).toBe(s)
  })

  it('les permanents d’un adversaire vont chez lui, jamais sur mon champ de bataille', () => {
    const theirs = [card('p2', 1), card('p2', 2)]
    const s0 = place(game(), theirs.map((id) => ({ id, player: 'p2', zone: 'battlefield' as const })))
    expect(canApply(s0, many(theirs, 'battlefield', { places: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }))).toBeNull()
    expect(canApply(s0, many(theirs, 'graveyard'))).toBeNull()
    expect(applyAction(s0, many(theirs, 'graveyard')).players.p2.zones.graveyard.slice(-2)).toEqual([theirs[1], theirs[0]])
  })
})
