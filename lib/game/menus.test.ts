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
      'Engager', 'Retourner', 'Face cachée', '+1/+1', '-1/-1', 'Compteur',
      'Donner le contrôle à Bob', 'Donner le contrôle à Chloé',
      'Main', 'Cimetière', 'Exil', 'Zone de commandement', 'Dessus de la bibliothèque', 'Dessous de la bibliothèque',
    ])
    expect(item(entries, 'Donner le contrôle à Bob')).toEqual([{ kind: 'action', action: { type: 'giveControl', id: card('p1', 4), to: 'p2' } }])
    expect(item(entries, 'Cimetière')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p1', 4), to: at('p1', 'graveyard') } }])
  })

  it('carte d’un adversaire sur son champ de bataille', () => {
    const s = setup()
    const entries = cardMenu(ctx(s), visible(s, card('p2', 2)), at('p2', 'battlefield'))
    expect(labels(entries)).toEqual(['Engager', '+1/+1', '-1/-1', 'Compteur', 'Prendre le contrôle', 'Dans sa main', 'Dans son cimetière', 'Dans son exil'])
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
