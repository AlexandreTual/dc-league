import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import {
  bind, cardShortcutCommands, comboOf, DEFAULT_BINDINGS, isTypingTarget, keyLabel, menuHints, parseBindings, shortcutFor, zoneOf,
  type CardShortcut,
} from './keyboard'
import { cardMenu, libraryMenu, type MenuContext, type MenuEntry } from './menus'
import { viewFor } from './view'
import type { GameState, PlayerZone, VisibleCard } from './types'

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, isContentEditable: false, ...extra }) as unknown as EventTarget
const key = (k: string, mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}, target: EventTarget | null = el('BODY')) => ({
  key: k, ctrlKey: !!mods.ctrlKey, metaKey: !!mods.metaKey, shiftKey: !!mods.shiftKey, altKey: !!mods.altKey, target,
})

describe('shortcutFor', () => {
  it.each([
    ['d', 'draw'], ['u', 'untapAll'], ['n', 'nextTurn'], ['s', 'shuffle'], ['m', 'mulligan'], ['Escape', 'close'],
    ['t', 'tap'], ['g', 'toGraveyard'], ['e', 'toExile'], ['h', 'toHand'], ['+', 'plusCounter'], ['-', 'minusCounter'], ['?', 'help'],
  ])('%s → %s', (k, expected) => {
    expect(shortcutFor(key(k))).toBe(expected)
  })

  it('Maj compte pour les lettres : L dessus, Maj+L dessous', () => {
    expect(shortcutFor(key('l'))).toBe('toLibraryTop')
    expect(shortcutFor(key('L', { shiftKey: true }))).toBe('toLibraryBottom')
    expect(shortcutFor(key('F', { shiftKey: true }))).toBe('faceDown')
  })

  it('« + » et « ? » tapés avec Maj (AZERTY) ou sans', () => {
    expect(shortcutFor(key('+', { shiftKey: true }))).toBe('plusCounter')
    expect(shortcutFor(key('?', { shiftKey: true }))).toBe('help')
  })

  it('Ctrl+Z et Cmd+Z annulent, Ctrl+X crée un jeton copie', () => {
    expect(shortcutFor(key('z', { ctrlKey: true }))).toBe('undo')
    expect(shortcutFor(key('Z', { metaKey: true }))).toBe('undo')
    expect(shortcutFor(key('x', { ctrlKey: true }))).toBe('copy')
  })

  it('z seul, x seul et les Ctrl non attribués ne font rien (raccourcis du navigateur)', () => {
    expect(shortcutFor(key('z'))).toBeNull()
    expect(shortcutFor(key('x'))).toBeNull()
    expect(shortcutFor(key('d', { ctrlKey: true }))).toBeNull()
    expect(shortcutFor(key('s', { metaKey: true }))).toBeNull()
  })

  it('suit les touches choisies', () => {
    const { bindings } = bind(DEFAULT_BINDINGS, 'tap', 'space')
    expect(shortcutFor(key(' '), bindings)).toBe('tap')
    expect(shortcutFor(key('t'), bindings)).toBeNull()
  })

  it('ne réagit pas pendant la saisie, sauf Échap', () => {
    expect(shortcutFor(key('d', {}, el('INPUT')))).toBeNull()
    expect(shortcutFor(key('z', { ctrlKey: true }, el('TEXTAREA')))).toBeNull()
    expect(shortcutFor(key('Escape', {}, el('INPUT')))).toBe('close')
  })
})

describe('comboOf et keyLabel', () => {
  it('ignore une touche de modification seule', () => {
    expect(comboOf(key('Shift', { shiftKey: true }))).toBeNull()
    expect(comboOf(key('Control', { ctrlKey: true }))).toBeNull()
  })
  it('normalise et affiche', () => {
    expect(comboOf(key('X', { ctrlKey: true, shiftKey: true }))).toBe('ctrl+shift+x')
    expect(comboOf(key('ArrowUp', { shiftKey: true }))).toBe('shift+arrowup')
    expect(keyLabel('ctrl+shift+x')).toBe('Ctrl+Maj+X')
    expect(keyLabel('space')).toBe('Espace')
    expect(keyLabel('ctrl++')).toBe('Ctrl++')
    expect(keyLabel('+')).toBe('+')
  })
})

describe('bind et parseBindings', () => {
  it('une touche déjà prise passe au nouveau raccourci', () => {
    const { bindings, replaced } = bind(DEFAULT_BINDINGS, 'tap', 'd')
    expect(replaced).toBe('draw')
    expect(bindings.tap).toBe('d')
    expect(bindings.draw).toBeNull()
  })

  it('retirer une touche', () => {
    expect(bind(DEFAULT_BINDINGS, 'toCommand', null)).toEqual({ bindings: { ...DEFAULT_BINDINGS, toCommand: null }, replaced: null })
  })

  it('relit les touches changées par-dessus celles par défaut, ignore l’illisible', () => {
    expect(parseBindings(null)).toEqual(DEFAULT_BINDINGS)
    expect(parseBindings('pas du json')).toEqual(DEFAULT_BINDINGS)
    expect(parseBindings('[1]')).toEqual(DEFAULT_BINDINGS)
    const parsed = parseBindings(JSON.stringify({ tap: 'space', toCommand: null, inconnu: 'q', draw: 42, shuffle: 'escape' }))
    expect(parsed).toEqual({ ...DEFAULT_BINDINGS, tap: 'space', toCommand: null })
  })

  it('une touche enregistrée deux fois : un seul raccourci la garde', () => {
    const parsed = parseBindings(JSON.stringify({ tap: 'q', flip: 'q' }))
    expect(parsed.flip).toBe('q')
    expect(parsed.tap).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('%s est une zone de saisie', (tag) => {
    expect(isTypingTarget(el(tag))).toBe(true)
  })
  it('contenteditable est une zone de saisie', () => {
    expect(isTypingTarget(el('DIV', { isContentEditable: true }))).toBe(true)
  })
  it('un bouton ou rien ne l’est pas', () => {
    expect(isTypingTarget(el('BUTTON'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('raccourcis de la carte survolée', () => {
  const setup = () => place(run(setupFor('commander', 3), start(1)), [
    { id: card('p1', 2), player: 'p1', zone: 'battlefield' },
    { id: card('p1', 4), player: 'p1', zone: 'battlefield' },
    { id: card('p1', 3), player: 'p1', zone: 'hand' },
    { id: card('p2', 2), player: 'p2', zone: 'battlefield' },
    { id: card('p2', 4), player: 'p2', zone: 'graveyard' },
  ])
  const ctx = (s: GameState): MenuContext => ({ me: 'p1', view: viewFor(s, 'p1'), catalogs: s.catalogs, lang: 'fr', readOnly: false })
  const visible = (s: GameState, id: string) => {
    const c = s.cards[id]
    return { hidden: false, id, owner: c.owner, ref: c.ref, token: c.token, isCommander: c.isCommander, tapped: c.tapped, flipped: c.flipped,
      faceDown: c.faceDown, counters: c.counters, x: c.x, y: c.y } as VisibleCard
  }
  const commands = (s: GameState, id: string, player: string, zone: PlayerZone, shortcut: CardShortcut, c = visible(s, id)) =>
    cardShortcutCommands(cardMenu(ctx(s), c, { player, zone }), c, { player, zone }, shortcut)
  const act = (action: unknown) => [{ kind: 'action', action }]

  it('zoneOf trouve la zone d’une carte visible', () => {
    const s = setup()
    expect(zoneOf(viewFor(s, 'p1'), card('p2', 4))).toEqual({ player: 'p2', zone: 'graveyard' })
    expect(zoneOf(viewFor(s, 'p1'), card('p1', 3))).toEqual({ player: 'p1', zone: 'hand' })
    expect(zoneOf(viewFor(s, 'p1'), 'absente')).toBeNull()
  })

  it('ma carte en jeu : engager, jeton copie, cimetière, dessous de la bibliothèque', () => {
    const s = setup()
    const id = card('p1', 4)
    expect(commands(s, id, 'p1', 'battlefield', 'tap')).toEqual(act({ type: 'tap', id }))
    expect(commands(s, id, 'p1', 'battlefield', 'flip')).toEqual(act({ type: 'flip', id }))
    const copy = commands(s, id, 'p1', 'battlefield', 'copy')
    expect(copy).toHaveLength(1)
    expect(copy![0]).toMatchObject({ kind: 'action', action: { type: 'createToken', copy: true } })
    expect(commands(s, id, 'p1', 'battlefield', 'toGraveyard')).toEqual(act({ type: 'move', id, to: { player: 'p1', zone: 'graveyard' } }))
    expect(commands(s, id, 'p1', 'battlefield', 'toLibraryBottom')).toEqual(act({ type: 'move', id, to: { player: 'p1', zone: 'library' }, position: 'bottom' }))
    expect(commands(s, id, 'p1', 'battlefield', 'toBattlefield')).toBeNull()
    expect(commands(s, id, 'p1', 'battlefield', 'abilities')).toEqual([{ kind: 'abilities', id }])
  })

  it('marqueurs +1/+1 : ajouter, retirer seulement s’il y en a', () => {
    const s = setup()
    const id = card('p1', 2)
    expect(commands(s, id, 'p1', 'battlefield', 'plusCounter')).toEqual(act({ type: 'counter', id, kind: 'plus', delta: 1 }))
    expect(commands(s, id, 'p1', 'battlefield', 'minusCounter')).toBeNull()
    const withCounter = { ...visible(s, id), counters: { plus: 2, minus: 0, other: 0 } }
    expect(commands(s, id, 'p1', 'battlefield', 'minusCounter', withCounter)).toEqual(act({ type: 'counter', id, kind: 'plus', delta: -1 }))
  })

  it('carte d’un adversaire : chez son propriétaire, jamais prise de contrôle par B', () => {
    const s = setup()
    const id = card('p2', 2)
    expect(commands(s, id, 'p2', 'battlefield', 'toGraveyard')).toEqual(act({ type: 'move', id, to: { player: 'p2', zone: 'graveyard' } }))
    expect(commands(s, id, 'p2', 'battlefield', 'toBattlefield')).toBeNull()
    expect(commands(s, id, 'p2', 'battlefield', 'flip')).toBeNull()
    expect(commands(s, card('p2', 4), 'p2', 'graveyard', 'toBattlefield')).toEqual(act({ type: 'move', id: card('p2', 4), to: { player: 'p1', zone: 'battlefield' } }))
  })

  it('carte en main : jouer, révéler ; pas d’engagement', () => {
    const s = setup()
    const id = card('p1', 3)
    expect(commands(s, id, 'p1', 'hand', 'toBattlefield')).toEqual(act({ type: 'move', id, to: { player: 'p1', zone: 'battlefield' } }))
    expect(commands(s, id, 'p1', 'hand', 'reveal')).toEqual(act({ type: 'reveal', ids: [id], to: 'all' }))
    expect(commands(s, id, 'p1', 'hand', 'tap')).toBeNull()
    expect(commands(s, id, 'p1', 'hand', 'toHand')).toBeNull()
  })

  const hintOf = (entries: MenuEntry[], hints: (string | null)[], label: string) =>
    hints[entries.findIndex((e) => (e.kind === 'item' || e.kind === 'stepper') && e.label === label)]

  it('menu d’une carte : la touche de chaque entrée, en suivant les touches choisies', () => {
    const s = setup()
    const id = card('p1', 4)
    const c = visible(s, id)
    const zone = { player: 'p1', zone: 'battlefield' as const }
    const entries = cardMenu(ctx(s), c, zone)
    const hints = menuHints(entries, DEFAULT_BINDINGS, { card: c, zone })
    expect(hintOf(entries, hints, 'Engager')).toBe('T')
    expect(hintOf(entries, hints, 'Créer un jeton copie')).toBe('Ctrl+X')
    expect(hintOf(entries, hints, 'Cimetière')).toBe('G')
    expect(hintOf(entries, hints, 'Dessous de la bibliothèque')).toBe('Maj+L')
    expect(hintOf(entries, hints, '+1/+1')).toBe('- +')
    expect(hintOf(entries, hints, 'Pivoter à 180°')).toBeNull()
    expect(hintOf(entries, hints, 'Mettre devant')).toBeNull()
    const custom = menuHints(entries, bind(DEFAULT_BINDINGS, 'tap', 'space').bindings, { card: c, zone })
    expect(hintOf(entries, custom, 'Engager')).toBe('Espace')
    expect(hintOf(entries, menuHints(entries, bind(DEFAULT_BINDINGS, 'toGraveyard', null).bindings, { card: c, zone }), 'Cimetière')).toBeNull()
  })

  it('menu de la bibliothèque : piocher et mélanger', () => {
    const s = setup()
    const entries = libraryMenu(ctx(s), 'p1')
    const hints = menuHints(entries, DEFAULT_BINDINGS)
    expect(hintOf(entries, hints, 'Piocher 1')).toBe('D')
    expect(hintOf(entries, hints, 'Mélanger')).toBe('S')
    expect(hintOf(entries, hints, 'Piocher N…')).toBeNull()
  })
})
