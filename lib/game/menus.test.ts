import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { cardMenu, handMenu, libraryMenu, type MenuContext, type MenuEntry } from './menus'
import { viewFor } from './view'
import type { GameState, PlayerZone, VisibleCard } from './types'

function setup() {
  const s = place(run(setupFor('commander', 3), start(1)), [
    { id: card('p1', 2), player: 'p1', zone: 'battlefield' },
    { id: card('p1', 4), player: 'p1', zone: 'battlefield' },
    { id: card('p2', 2), player: 'p2', zone: 'battlefield' },
    { id: card('p2', 4), player: 'p2', zone: 'graveyard' },
  ])
  return s
}
const ctx = (s: GameState, me: string | null = 'p1', readOnly = false): MenuContext =>
  ({ me, view: viewFor(s, me ?? ''), catalogs: s.catalogs, lang: 'fr', readOnly })
const visible = (s: GameState, id: string) => {
  const c = s.cards[id]
  return { hidden: false, id, owner: c.owner, ref: c.ref, token: c.token, isCommander: c.isCommander, tapped: c.tapped, flipped: c.flipped,
    faceDown: c.faceDown, counters: c.counters, x: c.x, y: c.y } as VisibleCard
}
const labels = (entries: MenuEntry[]) => entries.flatMap((e) => (e.kind === 'item' || e.kind === 'stepper' ? [e.label] : []))
const item = (entries: MenuEntry[], label: string) => {
  const e = entries.find((x) => x.kind === 'item' && x.label === label)
  if (!e || e.kind !== 'item') throw new Error(`entrée absente : ${label}`)
  return e.commands
}
const at = (player: string, zone: PlayerZone) => ({ player, zone })

describe('cardMenu', () => {
  it('ma carte sur mon champ de bataille : mode test + donner le contrôle', () => {
    const s = setup()
    const entries = cardMenu(ctx(s), visible(s, card('p1', 4)), at('p1', 'battlefield'))
    expect(entries[0]).toEqual({ kind: 'title', label: 'Delver of Secrets // Insectile Aberration' })
    expect(labels(entries)).toEqual([
      'Engager', 'Retourner', 'Face cachée', '+1/+1', '-1/-1', 'Compteur', 'Créer un jeton copie', 'Créer des jetons copies…',
      'Donner le contrôle à Bob', 'Donner le contrôle à Chloé',
      'Main', 'Cimetière', 'Exil', 'Zone de commandement', 'Dessus de la bibliothèque', 'Dessous de la bibliothèque',
    ])
    expect(item(entries, 'Donner le contrôle à Bob')).toEqual([{ kind: 'action', action: { type: 'giveControl', id: card('p1', 4), to: 'p2' } }])
    expect(item(entries, 'Cimetière')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p1', 4), to: at('p1', 'graveyard') } }])
  })

  it('carte d’un adversaire sur son champ de bataille', () => {
    const s = setup()
    const entries = cardMenu(ctx(s), visible(s, card('p2', 2)), at('p2', 'battlefield'))
    expect(labels(entries)).toEqual(['Engager', '+1/+1', '-1/-1', 'Compteur', 'Créer un jeton copie', 'Créer des jetons copies…', 'Prendre le contrôle', 'Dans sa main', 'Dans son cimetière', 'Dans son exil'])
    expect(item(entries, 'Prendre le contrôle')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p2', 2), to: at('p1', 'battlefield') } }])
    expect(item(entries, 'Dans son cimetière')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p2', 2), to: at('p2', 'graveyard') } }])
  })

  it('carte du cimetière d’un adversaire', () => {
    const s = setup()
    const entries = cardMenu(ctx(s), visible(s, card('p2', 4)), at('p2', 'graveyard'))
    expect(labels(entries)).toEqual(['Sur mon champ de bataille', 'Dans sa main', 'Dans son exil'])
  })

  it('carte de ma main : révéler à tous ou à un joueur', () => {
    const s = setup()
    const id = s.players.p1.zones.hand[0]
    const entries = cardMenu(ctx(s), visible(s, id), at('p1', 'hand'))
    expect(labels(entries).slice(0, 3)).toEqual(['Révéler à tous', 'Révéler à Bob', 'Révéler à Chloé'])
    expect(item(entries, 'Révéler à Bob')).toEqual([{ kind: 'action', action: { type: 'reveal', ids: [id], to: ['p2'] } }])
    expect(labels(entries)).toContain('Champ de bataille')
    expect(labels(entries)).not.toContain('Main')
  })

  it('carte volée sur mon champ de bataille : retourne chez son propriétaire', () => {
    const s = place(setup(), [{ id: card('p2', 2), player: 'p1', zone: 'battlefield' }])
    const entries = cardMenu(ctx(s), visible(s, card('p2', 2)), at('p1', 'battlefield'))
    expect(item(entries, 'Cimetière')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p2', 2), to: at('p2', 'graveyard') } }])
  })

  it('spectateur ou partie finie : aucun menu', () => {
    const s = setup()
    expect(cardMenu(ctx(s, null), visible(s, card('p2', 2)), at('p2', 'battlefield'))).toEqual([])
    expect(cardMenu(ctx(s, 'p1', true), visible(s, card('p1', 2)), at('p1', 'battlefield'))).toEqual([])
    expect(libraryMenu(ctx(s, null), 'p2')).toEqual([])
    expect(handMenu(ctx(s, 'p1', true))).toEqual([])
  })
})

describe('jetons copies', () => {
  const copyOf = (entries: MenuEntry[]) => {
    const [cmd] = item(entries, 'Créer un jeton copie')
    if (cmd.kind !== 'action' || cmd.action.type !== 'createToken') throw new Error('createToken attendu')
    return cmd.action
  }
  const moved = (s: GameState, id: string, patch: Partial<GameState['cards'][string]>): GameState =>
    ({ ...s, cards: { ...s.cards, [id]: { ...s.cards[id], ...patch } } })

  it('ma carte : jeton à côté de l’original, avec son nom, son type et son image', () => {
    const s = moved(setup(), card('p1', 2), { x: 30, y: 40 })
    const action = copyOf(cardMenu(ctx(s), visible(s, card('p1', 2)), at('p1', 'battlefield')))
    expect(action).toEqual({
      type: 'createToken', copy: true, x: 34, y: 44,
      token: { name: 'Anneau solaire', typeLine: 'Artifact', image: 'https://cards.scryfall.io/normal/sol.jpg', power: null, toughness: null, colors: [] },
    })
  })

  it('position bornée à 100', () => {
    const s = moved(setup(), card('p1', 2), { x: 98, y: 99 })
    expect(copyOf(cardMenu(ctx(s), visible(s, card('p1', 2)), at('p1', 'battlefield')))).toMatchObject({ x: 100, y: 100 })
  })

  it('carte d’un adversaire : jeton au centre de mon champ de bataille', () => {
    const s = moved(setup(), card('p2', 2), { x: 30, y: 40 })
    expect(copyOf(cardMenu(ctx(s), visible(s, card('p2', 2)), at('p2', 'battlefield')))).toMatchObject({ x: 50, y: 50, copy: true })
  })

  it('carte transformée : nom et image de la face arrière', () => {
    const s = moved(setup(), card('p1', 4), { flipped: true })
    expect(copyOf(cardMenu(ctx(s), visible(s, card('p1', 4)), at('p1', 'battlefield'))).token)
      .toMatchObject({ name: 'Insectile Aberration', typeLine: 'Creature — Human Insect', image: 'back.jpg' })
  })

  it('copie d’un jeton : même TokenData', () => {
    const soldier = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: ['W'], image: 'soldat.jpg' }
    const s = run(setupFor('commander', 2), start(1), { type: 'createToken', actor: 'p1', token: soldier, x: 10, y: 10 })
    expect(copyOf(cardMenu(ctx(s), visible(s, 't1'), at('p1', 'battlefield'))).token).toEqual(soldier)
  })

  it('carte face cachée : pas de copie', () => {
    const s = moved(setup(), card('p1', 2), { faceDown: true })
    const entries = cardMenu(ctx(s), visible(s, card('p1', 2)), at('p1', 'battlefield'))
    expect(labels(entries)).not.toContain('Créer un jeton copie')
    expect(labels(entries)).not.toContain('Créer des jetons copies…')
  })

  it('plusieurs jetons : de 1 à 20, décalés de 3 points', () => {
    const s = moved(setup(), card('p1', 2), { x: 30, y: 40 })
    const [ask] = item(cardMenu(ctx(s), visible(s, card('p1', 2)), at('p1', 'battlefield')), 'Créer des jetons copies…')
    if (ask.kind !== 'ask') throw new Error('ask attendu')
    expect(ask.question).toBe('Combien de jetons ?')
    expect(ask.fallback).toBe(2)
    const positions = ask.then(3).map((c) => (c.kind === 'action' && c.action.type === 'createToken' ? [c.action.x, c.action.y] : null))
    expect(positions).toEqual([[34, 44], [37, 47], [40, 50]])
    expect(ask.then(25)).toHaveLength(20)
    expect(ask.then(0)).toHaveLength(1)
  })
})

describe('libraryMenu et handMenu', () => {
  it('ma bibliothèque : menu du mode test + carte du dessus révélée', () => {
    const s = setup()
    const entries = libraryMenu(ctx(s), 'p1')
    expect(entries[0]).toEqual({ kind: 'title', label: `Bibliothèque (${s.players.p1.zones.library.length})` })
    expect(labels(entries)).toEqual(['Piocher 1', 'Piocher N…', 'Mélanger', 'Regarder les X du dessus…', 'Chercher une carte…',
      'Révéler la carte du dessus', 'Jouer avec la carte du dessus révélée'])
  })

  it('bibliothèque d’un adversaire : regarder ou chercher', () => {
    const s = setup()
    const entries = libraryMenu(ctx(s), 'p2')
    expect(labels(entries)).toEqual(['Regarder les X du dessus…', 'Chercher une carte…'])
    const [ask] = item(entries, 'Regarder les X du dessus…')
    if (ask.kind !== 'ask') throw new Error('ask attendu')
    expect(ask.then(3)).toEqual([
      { kind: 'action', action: { type: 'look', target: 'p2', count: 3 } },
      { kind: 'openPile', player: 'p2', zone: 'library', mode: 'look', title: 'Les 3 cartes du dessus' },
    ])
  })

  it('ma main : la révéler', () => {
    const s = setup()
    expect(item(handMenu(ctx(s)), 'Révéler ma main')).toEqual([{ kind: 'action', action: { type: 'reveal', ids: 'hand', to: 'all' } }])
  })
})
