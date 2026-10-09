import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { cardMenu, handMenu, libraryMenu, ptMenu, type MenuContext, type MenuEntry } from './menus'
import { applyAction } from './apply'
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
    faceDown: c.faceDown, counters: c.counters, ...(c.ptMod ? { ptMod: c.ptMod } : {}), x: c.x, y: c.y } as VisibleCard
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
      'Engager', 'Retourner', 'Face cachée', '+1/+1', '-1/-1', 'Compteur', 'Force', 'Endurance', 'Créer un jeton copie', 'Créer des jetons copies…',
      'Donner le contrôle à Bob', 'Donner le contrôle à Chloé',
      'Main', 'Cimetière', 'Exil', 'Zone de commandement', 'Dessus de la bibliothèque', 'Dessous de la bibliothèque',
      'Oracle et règles',
    ])
    expect(item(entries, 'Donner le contrôle à Bob')).toEqual([{ kind: 'action', action: { type: 'giveControl', id: card('p1', 4), to: 'p2' } }])
    expect(item(entries, 'Cimetière')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p1', 4), to: at('p1', 'graveyard') } }])
  })

  it('carte d’un adversaire sur son champ de bataille', () => {
    const s = setup()
    const entries = cardMenu(ctx(s), visible(s, card('p2', 2)), at('p2', 'battlefield'))
    expect(labels(entries)).toEqual(['Engager', '+1/+1', '-1/-1', 'Compteur', 'Force', 'Endurance', 'Créer un jeton copie', 'Créer des jetons copies…', 'Prendre le contrôle', 'Dans sa main', 'Dans son cimetière', 'Dans son exil', 'Oracle et règles'])
    expect(item(entries, 'Prendre le contrôle')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p2', 2), to: at('p1', 'battlefield') } }])
    expect(item(entries, 'Dans son cimetière')).toEqual([{ kind: 'action', action: { type: 'move', id: card('p2', 2), to: at('p2', 'graveyard') } }])
  })

  it('marqueurs : nombre tapé directement, envoyé comme écart (compatible avec un serveur plus ancien)', () => {
    const s = setup()
    const id = card('p1', 2)
    const withCounters = { ...visible(s, id), counters: { plus: 3, minus: 0, other: 0 } }
    const entries = cardMenu(ctx(s), withCounters, at('p1', 'battlefield'))
    const stepper = (label: string) => {
      const e = entries.find((x) => x.kind === 'stepper' && x.label === label)
      if (!e || e.kind !== 'stepper' || !e.set) throw new Error(`saisie absente : ${label}`)
      return e.set
    }
    expect(stepper('+1/+1')(10)).toEqual([{ kind: 'action', action: { type: 'counter', id, kind: 'plus', delta: 7 } }])
    expect(stepper('+1/+1')(0)).toEqual([{ kind: 'action', action: { type: 'counter', id, kind: 'plus', delta: -3 } }])
    expect(stepper('+1/+1')(3)).toEqual([])
    expect(stepper('-1/-1')(-5)).toEqual([])
    expect(stepper('Compteur')(2.7)).toEqual([{ kind: 'action', action: { type: 'counter', id, kind: 'other', delta: 2 } }])
    expect(stepper('Compteur')(NaN)).toEqual([])
    const tax = entries.find((x) => x.kind === 'stepper' && x.label === 'Taxe')
    expect(tax === undefined || (tax.kind === 'stepper' && tax.set === undefined)).toBe(true)
  })

  it('force et endurance : valeur affichée, nombre tapé = nouvelle valeur, réinitialisation', () => {
    const id = card('p2', 4)
    let s = place(setup(), [{ id, player: 'p2', zone: 'battlefield' }])
    s = applyAction(s, { type: 'counter', actor: 'p2', id, kind: 'plus', delta: 1 })
    const steppers = (st: GameState) => {
      const entries = cardMenu(ctx(st), visible(st, id), at('p2', 'battlefield'))
      const find = (label: string) => {
        const e = entries.find((x) => x.kind === 'stepper' && x.label === label)
        if (!e || e.kind !== 'stepper' || !e.set) throw new Error(`saisie absente : ${label}`)
        return e
      }
      return { entries, power: find('Force'), toughness: find('Endurance') }
    }
    let { entries, power, toughness } = steppers(s)
    expect([power.value, toughness.value]).toEqual(['2', '2'])
    expect(power.signed).toBe(true)
    expect(power.plus).toEqual({ kind: 'action', action: { type: 'pt', id, power: 1, toughness: 0 } })
    expect(toughness.minus).toEqual({ kind: 'action', action: { type: 'pt', id, power: 0, toughness: -1 } })
    expect(power.set!(5)).toEqual([{ kind: 'action', action: { type: 'pt', id, power: 3, toughness: 0 } }])
    expect(toughness.set!(-1)).toEqual([{ kind: 'action', action: { type: 'pt', id, power: 0, toughness: -3 } }])
    expect(power.set!(2)).toEqual([])
    expect(labels(entries)).not.toContain('Réinitialiser force/endurance')

    s = applyAction(s, { type: 'pt', actor: 'p1', id, power: 3, toughness: -1 })
    ;({ entries, power, toughness } = steppers(s))
    expect([power.value, toughness.value]).toEqual(['5', '1'])
    expect(item(entries, 'Réinitialiser force/endurance')).toEqual([{ kind: 'action', action: { type: 'pt', id, power: -3, toughness: 1 } }])
  })

  it('force et endurance d’une carte qui n’en a pas : écart affiché et tapé', () => {
    const s = setup()
    const id = card('p1', 2)
    const entries = cardMenu(ctx(s), visible(s, id), at('p1', 'battlefield'))
    const power = entries.find((x) => x.kind === 'stepper' && x.label === 'Force')
    if (!power || power.kind !== 'stepper' || !power.set) throw new Error('Force absente')
    expect(power.value).toBe('+0')
    expect(power.set(2)).toEqual([{ kind: 'action', action: { type: 'pt', id, power: 2, toughness: 0 } }])
  })

  it('ptMenu : seulement force et endurance, pour tout joueur, rien pour un spectateur', () => {
    const s = setup()
    const id = card('p1', 4)
    const entries = ptMenu(ctx(s, 'p2'), visible(s, id))
    expect(entries[0]).toEqual({ kind: 'title', label: 'Delver of Secrets // Insectile Aberration' })
    expect(labels(entries)).toEqual(['Force', 'Endurance'])
    expect(ptMenu(ctx(s, null), visible(s, id))).toEqual([])
    expect(ptMenu(ctx(s, 'p1', true), visible(s, id))).toEqual([])
  })

  it('jeton copie : reprend la force et l’endurance imprimées de l’original (sans marqueurs ni modification)', () => {
    let s = setup()
    s = applyAction(s, { type: 'counter', actor: 'p1', id: card('p1', 4), kind: 'plus', delta: 2 })
    s = applyAction(s, { type: 'pt', actor: 'p1', id: card('p1', 4), power: 1, toughness: 1 })
    const entries = cardMenu(ctx(s), visible(s, card('p1', 4)), at('p1', 'battlefield'))
    const [command] = item(entries, 'Créer un jeton copie')
    expect(command).toMatchObject({ kind: 'action', action: { type: 'createToken', token: { power: '1', toughness: '1' } } })
  })

  it('carte du cimetière d’un adversaire', () => {
    const s = setup()
    const entries = cardMenu(ctx(s), visible(s, card('p2', 4)), at('p2', 'graveyard'))
    expect(labels(entries)).toEqual(['Sur mon champ de bataille', 'Dans sa main', 'Dans son exil', 'Oracle et règles'])
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

  it('après un mulligan : « Mettre au-dessous » en tête du menu d’une carte de ma main', () => {
    const s = applyAction(setup(), { type: 'mulligan', actor: 'p1', seed: 1 })
    const id = s.players.p1.zones.hand[0]
    const entries = cardMenu(ctx(s), visible(s, id), at('p1', 'hand'))
    expect(labels(entries)[0]).toBe('Mettre au-dessous')
    expect(item(entries, 'Mettre au-dessous')).toEqual([{ kind: 'action', action: { type: 'move', id, to: at('p1', 'library'), position: 'bottom' } }])
  })

  it('après un mulligan : « Mettre au-dessous » quelle que soit la taille de la main', () => {
    const bottomOf = (st: GameState) => cardMenu(ctx(st), visible(st, st.players.p1.zones.hand[0]), at('p1', 'hand'))
    let s = applyAction(setup(), { type: 'mulligan', actor: 'p1', seed: 1 })
    for (let i = 0; i < 6; i++) {
      s = applyAction(s, { type: 'move', actor: 'p1', id: s.players.p1.zones.hand[0], to: at('p1', 'library'), position: 'bottom' })
      expect(labels(bottomOf(s))).toContain('Mettre au-dessous')
    }
    let big = applyAction(setup(), { type: 'mulligan', actor: 'p1', seed: 2 })
    big = applyAction(big, { type: 'draw', actor: 'p1', count: 1 })
    expect(labels(bottomOf(big))).toContain('Mettre au-dessous')
  })

  it('pas de « Mettre au-dessous » avant tout mulligan, ni une fois la main gardée', () => {
    const fresh = setup()
    expect(labels(cardMenu(ctx(fresh), visible(fresh, fresh.players.p1.zones.hand[0]), at('p1', 'hand')))).not.toContain('Mettre au-dessous')
    const kept = applyAction(applyAction(fresh, { type: 'mulligan', actor: 'p1', seed: 1 }), { type: 'keep', actor: 'p1' })
    const after = cardMenu(ctx(kept), visible(kept, kept.players.p1.zones.hand[0]), at('p1', 'hand'))
    expect(labels(after)).not.toContain('Mettre au-dessous')
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
      .toMatchObject({ name: 'Insectile Aberration', typeLine: 'Creature — Human Insect', image: 'back.jpg', power: '3', toughness: '2' })
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

describe('Oracle et règles', () => {
  const moved = (s: GameState, id: string, patch: Partial<GameState['cards'][string]>): GameState =>
    ({ ...s, cards: { ...s.cards, [id]: { ...s.cards[id], ...patch } } })
  const ORACLE = 'Oracle et règles'

  it('carte visible : ouvre la fenêtre de la carte de son propriétaire', () => {
    const s = setup()
    expect(item(cardMenu(ctx(s), visible(s, card('p1', 2)), at('p1', 'battlefield')), ORACLE)).toEqual([{ kind: 'oracle', owner: 'p1', ref: 2 }])
    expect(item(cardMenu(ctx(s), visible(s, card('p2', 2)), at('p2', 'battlefield')), ORACLE)).toEqual([{ kind: 'oracle', owner: 'p2', ref: 2 }])
    expect(item(cardMenu(ctx(s), visible(s, card('p2', 4)), at('p2', 'graveyard')), ORACLE)).toEqual([{ kind: 'oracle', owner: 'p2', ref: 4 }])
    const inHand = s.players.p1.zones.hand[0]
    expect(labels(cardMenu(ctx(s), visible(s, inHand), at('p1', 'hand')))).toContain(ORACLE)
  })

  it('carte face cachée (la mienne ou celle d’un adversaire) : absente', () => {
    const mine = moved(setup(), card('p1', 2), { faceDown: true })
    expect(labels(cardMenu(ctx(mine), visible(mine, card('p1', 2)), at('p1', 'battlefield')))).not.toContain(ORACLE)
    const theirs = moved(setup(), card('p2', 2), { faceDown: true })
    expect(labels(cardMenu(ctx(theirs), visible(theirs, card('p2', 2)), at('p2', 'battlefield')))).not.toContain(ORACLE)
  })

  it('carte de la main d’un adversaire : absente', () => {
    const s = setup()
    const theirs = s.players.p2.zones.hand[0]
    expect(labels(cardMenu(ctx(s), visible(s, theirs), at('p2', 'hand')))).not.toContain(ORACLE)
  })

  it('jeton (créé à la main ou copie) : absente', () => {
    const soldier = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: ['W'], image: null }
    const s = run(setupFor('commander', 2), start(1), { type: 'createToken', actor: 'p1', token: soldier, x: 10, y: 10 })
    expect(labels(cardMenu(ctx(s), visible(s, 't1'), at('p1', 'battlefield')))).not.toContain(ORACLE)
  })

  it('données de la carte absentes du navigateur : absente', () => {
    const s = setup()
    const entries = cardMenu({ ...ctx(s), catalogs: { ...s.catalogs, p2: { ...s.catalogs.p2, entries: [] } } }, visible(s, card('p2', 2)), at('p2', 'battlefield'))
    expect(labels(entries)).not.toContain(ORACLE)
  })
})

describe('libraryMenu et handMenu', () => {
  it('ma bibliothèque : menu du mode test + carte du dessus révélée', () => {
    const s = setup()
    const entries = libraryMenu(ctx(s), 'p1')
    expect(entries[0]).toEqual({ kind: 'title', label: `Bibliothèque (${s.players.p1.zones.library.length})` })
    expect(labels(entries)).toEqual(['Piocher 1', 'Piocher N…', 'Mélanger', 'Regarder les X du dessus…', 'Chercher une carte…',
      'Révéler la carte du dessus', 'Jouer avec la carte du dessus révélée', 'Voir la carte du dessus (pour moi seul)'])
    expect(item(entries, 'Voir la carte du dessus (pour moi seul)')).toEqual([{ kind: 'action', action: { type: 'togglePeekTop' } }])
  })

  it('ma bibliothèque, option active : « Ne plus voir la carte du dessus »', () => {
    const s = applyAction(setup(), { type: 'togglePeekTop', actor: 'p1' })
    const entries = libraryMenu(ctx(s), 'p1')
    expect(labels(entries)).toContain('Ne plus voir la carte du dessus')
    expect(labels(entries)).not.toContain('Voir la carte du dessus (pour moi seul)')
    expect(item(entries, 'Ne plus voir la carte du dessus')).toEqual([{ kind: 'action', action: { type: 'togglePeekTop' } }])
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
