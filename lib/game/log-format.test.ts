import { describe, it, expect } from 'vitest'
import { card, place, setupFor } from '@/test/game-fixtures'
import { en, fr } from '@/lib/i18n/messages'
import { applyAction } from './apply'
import { formatLog } from './log-format'
import { createInitialState } from './setup'
import { viewFor } from './view'
import type { GameAction, GameState, LogEntry, LogParam, TokenData } from './types'

const kenrith = (p: string) => card(p, 1)
const sol = (p: string) => card(p, 2)
const forest = (p: string, n: number) => card(p, 3, n)
const delver = (p: string) => card(p, 4)
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: [], image: null }

/** Applique une action qui doit être acceptée et écrire au journal. */
function act(s: GameState, a: GameAction): GameState {
  const next = applyAction(s, a)
  if (next === s || next.log.length === s.log.length) throw new Error(`action refusée ou muette : ${JSON.stringify(a)}`)
  return next
}
const acts = (s: GameState, ...actions: GameAction[]) => actions.reduce(act, s)

/** Sol Ring de p2 devenu Teferi (loyauté 4). */
function withWalker(s: GameState): GameState {
  const entries = s.catalogs.p2.entries.map((e) => (e.ref === 2
    ? { ...e, fr: null, en: { ...e.en, name: 'Teferi, Time Raveler', type_line: 'Legendary Planeswalker — Teferi', loyalty: '4' } }
    : e))
  return { ...s, catalogs: { ...s.catalogs, p2: { ...s.catalogs.p2, entries } } }
}

/** Partie qui fait écrire au moteur chaque sorte de ligne du journal. */
function fullGame(): GameState {
  let s = createInitialState(setupFor('commander', 3))
  s = act(s, { type: 'start', actor: 'server', seed: 1, first: 'p1' })
  s = acts(s,
    { type: 'mulligan', actor: 'p1', seed: 2 },
    { type: 'keep', actor: 'p1' }, { type: 'keep', actor: 'p2' }, { type: 'keep', actor: 'p3' },
    { type: 'draw', actor: 'p1', count: 2 },
    { type: 'draw', actor: 'p1', count: 1 },
    { type: 'roll', actor: 'p1', sides: 20, count: 1, seed: 'a' },
    { type: 'roll', actor: 'p2', sides: 6, count: 3, seed: 'b' },
    { type: 'roll', actor: 'p1', sides: 2, count: 1, seed: 'c' },
    { type: 'roll', actor: 'p1', sides: 2, count: 3, seed: 'd' },
    { type: 'shuffle', actor: 'p1', seed: 3 },
  )
  s = withWalker(place(s, [
    { id: sol('p1'), player: 'p1', zone: 'hand' },
    { id: delver('p1'), player: 'p1', zone: 'battlefield' },
    { id: forest('p1', 1), player: 'p1', zone: 'hand' },
    { id: forest('p1', 2), player: 'p1', zone: 'hand' },
    { id: forest('p1', 3), player: 'p1', zone: 'hand' },
    { id: forest('p1', 4), player: 'p1', zone: 'graveyard' },
    { id: forest('p1', 5), player: 'p1', zone: 'graveyard' },
    { id: forest('p1', 6), player: 'p1', zone: 'battlefield' },
    { id: forest('p1', 7), player: 'p1', zone: 'battlefield' },
    { id: forest('p1', 8), player: 'p1', zone: 'battlefield' },
    { id: forest('p2', 1), player: 'p2', zone: 'battlefield' },
    { id: sol('p2'), player: 'p2', zone: 'battlefield' },
    { id: delver('p2'), player: 'p2', zone: 'battlefield' },
  ]))
  const p1 = (zone: 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command') => ({ player: 'p1', zone })
  s = acts(s,
    // Déplacements : nommés, vers une zone cachée, positions dans la bibliothèque, zone d'un autre joueur.
    { type: 'move', actor: 'p1', id: sol('p1'), to: p1('battlefield') },
    { type: 'move', actor: 'p1', id: forest('p1', 1), to: p1('library'), position: 'bottom' },
    { type: 'move', actor: 'p1', id: forest('p1', 2), to: p1('library'), position: 'top' },
    { type: 'move', actor: 'p1', id: forest('p1', 3), to: p1('library'), position: 2 },
    { type: 'move', actor: 'p1', id: kenrith('p1'), to: p1('battlefield') },
    { type: 'move', actor: 'p1', id: forest('p1', 4), to: p1('exile'), faceDown: true },
    { type: 'move', actor: 'p2', id: forest('p1', 5), to: p1('exile') },
    { type: 'moveTop', actor: 'p1', to: p1('graveyard') },
    { type: 'moveMany', actor: 'p1', ids: [forest('p1', 6), forest('p1', 7)], zone: 'library', position: 'bottom', random: true, seed: 4 },
    { type: 'moveMany', actor: 'p1', ids: [forest('p1', 5)], zone: 'graveyard' },
    // Jetons.
    { type: 'createToken', actor: 'p1', token: soldier, x: 10, y: 10 },
    { type: 'createToken', actor: 'p1', token: { ...soldier, name: 'Delver of Secrets' }, x: 20, y: 10, copy: true },
    { type: 'move', actor: 'p1', id: 't1', to: p1('graveyard') },
    // Marqueurs, force et endurance, loyauté.
    { type: 'counter', actor: 'p1', id: delver('p1'), kind: 'plus', delta: 2 },
    { type: 'counter', actor: 'p1', id: delver('p1'), kind: 'other', delta: 1 },
    { type: 'pt', actor: 'p2', id: kenrith('p1'), power: 2, toughness: 3 },
    { type: 'ptTurn', actor: 'p2', id: kenrith('p1'), power: 1, toughness: 0 },
    { type: 'pt', actor: 'p1', id: sol('p1'), power: 1, toughness: 1 },
    { type: 'pt', actor: 'p1', id: sol('p1'), power: -1, toughness: -1 },
    { type: 'loyalty', actor: 'p2', id: sol('p2'), delta: 2 },
    // Capacités et effets de groupe.
    { type: 'flip', actor: 'p1', id: delver('p1') },
    { type: 'abilities', actor: 'p2', id: kenrith('p1'), gained: ['Trample', 'Haste'], lost: [], untilEndOfTurn: true },
    { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: [{ keyword: 'Protection', param: 'R,G' }, { keyword: 'Ward', param: '{2}' }], lost: [] },
    { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: [{ keyword: 'Protection', param: 'all' }, { keyword: 'Ward', param: '{2}' }], lost: [] },
    { type: 'abilities', actor: 'p1', id: delver('p1'), gained: [{ keyword: 'Annihilator', param: '2' }], lost: ['Flying'] },
    { type: 'abilities', actor: 'p1', id: delver('p1'), gained: [], lost: [] },
    { type: 'effect', actor: 'p1', ids: [kenrith('p1'), delver('p1')], power: 1, toughness: 1, gained: ['Flying'], untilEndOfTurn: true },
    { type: 'effect', actor: 'p1', ids: [kenrith('p1'), delver('p1'), sol('p1'), forest('p1', 8), 't2'], power: 0, toughness: 0, gained: ['Vigilance'] },
    // Face cachée.
    { type: 'faceDown', actor: 'p1', id: forest('p1', 8) },
    { type: 'counter', actor: 'p1', id: forest('p1', 8), kind: 'minus', delta: 1 },
    { type: 'pt', actor: 'p1', id: forest('p1', 8), power: 1, toughness: 0 },
    { type: 'abilities', actor: 'p1', id: forest('p1', 8), gained: ['Reach'], lost: [] },
    { type: 'effect', actor: 'p1', ids: [forest('p1', 8), delver('p1')], power: 2, toughness: 0, gained: [] },
    { type: 'phase', actor: 'p1', id: forest('p1', 8) },
    { type: 'phase', actor: 'p1', id: forest('p1', 8) },
    { type: 'move', actor: 'p1', id: forest('p1', 8), to: p1('graveyard') },
    { type: 'faceDown', actor: 'p1', id: delver('p1') },
    { type: 'flip', actor: 'p1', id: delver('p1') },
    { type: 'faceDown', actor: 'p1', id: delver('p1') },
    { type: 'giveControl', actor: 'p1', id: sol('p1'), to: 'p2' },
    { type: 'faceDown', actor: 'p2', id: sol('p1') },
    { type: 'giveControl', actor: 'p2', id: sol('p1'), to: 'p1' },
    // Phases : hors phase, de retour, et au début du tour de son contrôleur.
    { type: 'phase', actor: 'p1', id: delver('p1') },
    { type: 'phase', actor: 'p1', id: delver('p1') },
    { type: 'phase', actor: 'p2', id: delver('p2') },
    // Joueurs.
    { type: 'commanderTax', actor: 'p1', id: kenrith('p1'), delta: 1 },
    { type: 'life', actor: 'p2', target: 'p1', delta: -3 },
    { type: 'poison', actor: 'p1', target: 'p2', delta: 2 },
    { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'énergie', delta: 3 },
    { type: 'commanderDamage', actor: 'p1', target: 'p2', commander: kenrith('p1'), delta: 1 },
    { type: 'commanderDamage', actor: 'p1', target: 'p2', commander: kenrith('p1'), delta: 4 },
    { type: 'setMonarch', actor: 'p1', to: 'p2' },
    { type: 'setMonarch', actor: 'p1', to: null },
    { type: 'setInitiative', actor: 'p1', to: 'p3' },
    { type: 'setInitiative', actor: 'p1', to: null },
    // Révélations et bibliothèques.
    { type: 'reveal', actor: 'p1', ids: 'hand', to: 'all' },
    { type: 'reveal', actor: 'p1', ids: 'hand', to: ['p2', 'p3'] },
    { type: 'revealTop', actor: 'p1' },
    { type: 'toggleTopRevealed', actor: 'p1' },
    { type: 'toggleTopRevealed', actor: 'p1' },
    { type: 'togglePeekTop', actor: 'p1' },
    { type: 'togglePeekTop', actor: 'p1' },
    { type: 'toggleKeepMana', actor: 'p1' },
    { type: 'toggleKeepMana', actor: 'p1' },
    { type: 'look', actor: 'p1', target: 'p2', count: 3 },
    { type: 'look', actor: 'p1', target: 'p1', count: 1 },
  )
  const [a, b] = s.players.p2.zones.library
  s = acts(s,
    { type: 'reorderTop', actor: 'p1', target: 'p2', ids: [b, a] },
    { type: 'endLook', actor: 'p1', target: 'p2', shuffle: false },
    { type: 'endLook', actor: 'p1', target: 'p1', shuffle: true, seed: 5 },
    { type: 'search', actor: 'p2', target: 'p2' },
  )
  const [x, y, z] = s.players.p2.zones.library
  s = acts(s,
    { type: 'move', actor: 'p2', id: x, to: { player: 'p2', zone: 'library' }, position: 'top' },
    { type: 'move', actor: 'p2', id: y, to: { player: 'p2', zone: 'library' }, position: 'bottom' },
    { type: 'move', actor: 'p2', id: z, to: { player: 'p2', zone: 'library' }, position: 'bottom' },
    { type: 'endLook', actor: 'p2', target: 'p2', shuffle: true, seed: 6, keep: true },
    { type: 'search', actor: 'p3', target: 'p1' },
  )
  const [w] = s.players.p1.zones.library
  s = acts(s,
    { type: 'move', actor: 'p3', id: w, to: { player: 'p1', zone: 'library' }, position: 'bottom' },
    { type: 'endLook', actor: 'p3', target: 'p1', shuffle: true, seed: 7, keep: true },
    { type: 'endTurn', actor: 'p1' },
    { type: 'endTurn', actor: 'p2', byHost: true },
    { type: 'eliminate', actor: 'p3', target: 'p3' },
  )
  // Bibliothèque vide : pioche et carte du dessus révélée.
  const empty = { ...s, players: { ...s.players, p1: { ...s.players.p1, zones: { ...s.players.p1.zones, library: [] } } } }
  s = acts(empty, { type: 'draw', actor: 'p1', count: 1 }, { type: 'revealTop', actor: 'p1' })
  return s
}

/** Début de partie tiré au sort. */
function drawnStart(): LogEntry[] {
  return act(createInitialState(setupFor('commander', 2)), { type: 'start', actor: 'server', seed: 1 }).log
}

const allEntries = (): { state: GameState; entries: LogEntry[] } => {
  const state = fullGame()
  return { state, entries: [...state.log, ...drawnStart()] }
}

describe('journal structuré', () => {
  const { state, entries } = allEntries()
  const view = viewFor(state, 'p1')

  it('chaque ligne du moteur porte un msg, et toutes les sortes de lignes sont couvertes', () => {
    for (const e of entries) expect(e.msg, e.text).toBeDefined()
    const keys = new Set(entries.map((e) => e.msg!.key))
    expect([...keys].sort()).toEqual(Object.keys(fr.log.lines).sort())
  })

  it('en français (cartes en français), redonne exactement text', () => {
    for (const e of entries) expect(formatLog(e, fr, 'fr', view, state.catalogs)).toBe(e.text)
  })

  it('en anglais : phrases anglaises, sans lettre accentuée hors des noms', () => {
    const lines = entries.map((e) => formatLog(e, en, 'en', view, state.catalogs))
    const byKey = new Map(entries.map((e, i) => [e.msg!.key, lines[i]]))
    expect(lines.every((l, i) => l !== entries[i].text || /^[^a-z]*$/i.test(l))).toBe(true)
    expect(lines).toContain('Game start: Alex goes first (chosen by the host)')
    expect(lines).toContain('Game start: Alex goes first')
    expect(lines).toContain('Mulligan #1')
    expect(lines).toContain('Keeps their hand')
    expect(lines).toContain('Draws 2 cards')
    expect(lines).toContain('Draws 1 card')
    expect(lines).toContain('Shuffles their library')
    expect(lines).toContain('Turn 1: Bob')
    expect(lines).toContain('Turn 1: Chloé (passed by the host)')
    expect(lines).toContain('Turn 2: Alex')
    expect(lines).toContain('Sol Ring: hand → battlefield')
    expect(lines).toContain('a card: hand → library (bottom)')
    expect(lines).toContain('a card: hand → library (position 2)')
    expect(lines).toContain('Forest: Alex\'s graveyard → Alex\'s exile')
    expect(lines).toContain('Creates a Soldat token')
    expect(lines).toContain('Creates a Delver of Secrets token (copy)')
    expect(lines).toContain('Soldat: battlefield → graveyard (vanishes)')
    expect(lines).toContain('Transforms Delver of Secrets // Insectile Aberration')
    expect(lines).toContain('Transforms a face-down card')
    expect(lines).toContain('Delver of Secrets // Insectile Aberration phases out')
    expect(lines).toContain('Delver of Secrets // Insectile Aberration phases in')
    expect(lines).toContain('a face-down card phases out')
    expect(lines).toContain('Turns a card face down')
    expect(lines).toContain('gives control of Sol Ring to Bob')
    expect(lines).toContain('gives control of a face-down card to Alex')
    expect(lines).toContain('Kenrith, the Returned King: 7/8 (+2/+3)')
    expect(lines).toContain('Kenrith, the Returned King: 8/8 (+2/+3, +1/+0 this turn)')
    expect(lines).toContain('Sol Ring: base power and toughness')
    expect(lines).toContain('Teferi, Time Raveler: loyalty 6')
    expect(lines).toContain('gives Trample and Haste to Kenrith, the Returned King (until end of turn)')
    expect(lines).toContain('gives Protection from red and green and Ward {2} to Kenrith, the Returned King; removes Trample and Haste from Kenrith, the Returned King')
    expect(lines).toContain('changes Protection on Kenrith, the Returned King: from everything')
    expect(lines).toContain('gives Annihilator 2 to Delver of Secrets // Insectile Aberration; removes Flying from Delver of Secrets // Insectile Aberration')
    expect(lines).toContain('removes Annihilator from Delver of Secrets // Insectile Aberration; gives Flying back to Delver of Secrets // Insectile Aberration')
    expect(lines).toContain('Turns Delver of Secrets // Insectile Aberration face up')
    expect(lines).toContain('Alex: énergie 3')
    expect(lines).toContain('looks at the top card of their library')
    expect(lines).toContain('You saw: Forest, Forest, Forest')
    expect(lines).toContain('puts the top 2 cards of Bob\'s library back in any order')
    expect(lines).toContain('reveals 8 cards to Bob, Chloé')
    expect(lines).toContain('No more monarch')
    expect(lines).toContain('No one has the initiative')
    expect(lines).toContain('Commander tax for Kenrith, the Returned King: 4')
    expect(lines).toContain('Alex: life 40 → 37')
    expect(lines).toContain('Bob: poison 2')
    expect(lines).toContain('Bob: 5 commander damage from Kenrith, the Returned King (life 35)')
    expect(lines).toContain('Bob becomes the monarch')
    expect(lines).toContain('Chloé takes the initiative')
    expect(lines).toContain('Chloé is eliminated')
    expect(lines).toContain('looks at the top 3 cards of Bob\'s library')
    expect(lines).toContain('looks at the top card of their library')
    expect(lines).toContain('stops looking at Bob\'s library')
    expect(lines).toContain('shuffles their library')
    expect(lines).toContain('shuffles their library, puts one card on top and 2 cards on the bottom')
    expect(lines).toContain('shuffles Alex\'s library and puts one card on the bottom')
    expect(lines).toContain('Library is empty')
    expect(byKey.get('roll')).toMatch(/^(Rolls|Coin flip|Flips)/)
    expect(lines.filter((l) => l.startsWith('Rolls a d20: ') || l.startsWith('Rolls 3d6: ') || l.startsWith('Coin flip: ') || l.startsWith('Flips 3 coins: '))).toHaveLength(4)
    expect(lines.some((l) => /^gives \+1\/\+1 and Flying to Kenrith, the Returned King and Delver/.test(l))).toBe(true)
    expect(lines.some((l) => / and 2 other cards$/.test(l))).toBe(true)
    expect(lines.some((l) => l === '1 card: exile → graveyard: Forest')).toBe(true)
    expect(lines.some((l) => l.startsWith('2 cards: battlefield → library (bottom, random order)'))).toBe(true)
  })

  it('noms des cartes dans la langue des cartes demandée, indépendante de l’interface', () => {
    const solLine = entries.find((e) => e.msg?.key === 'move' && e.text.startsWith('Anneau solaire'))!
    expect(formatLog(solLine, fr, 'fr', view, state.catalogs)).toBe('Anneau solaire : main → champ de bataille')
    expect(formatLog(solLine, fr, 'en', view, state.catalogs)).toBe('Sol Ring : main → champ de bataille')
    expect(formatLog(solLine, en, 'fr', view, state.catalogs)).toBe('Anneau solaire: hand → battlefield')
  })

  it('carte face cachée jamais nommée, en français comme en anglais', () => {
    const hidden = entries.filter((e) => e.text.includes('face cachée'))
    expect(hidden.length).toBeGreaterThan(5)
    for (const e of hidden) {
      const out = formatLog(e, en, 'en', view, state.catalogs)
      expect(out, e.text).not.toMatch(/Forest|Anneau|Sol Ring/)
    }
  })

  it('non-fuite : une carte n’est donnée que par une ligne qui la nomme déjà', () => {
    const cardsOf = (p: LogParam): { owner: string; ref: number | null; token?: string }[] =>
      typeof p === 'object' && !Array.isArray(p) && 'card' in p ? [p.card]
        : typeof p === 'object' && !Array.isArray(p) && 'cards' in p ? p.cards.filter((c) => c !== null) : []
    for (const e of entries) {
      for (const p of Object.values(e.msg?.params ?? {})) {
        for (const c of cardsOf(p)) {
          const name = formatLog({ text: '', msg: { key: 'revealTop', params: { c: { card: c } } } }, fr, 'fr', view, state.catalogs).slice('révèle '.length)
          expect(e.text, JSON.stringify(c)).toContain(name)
        }
      }
    }
  })

  it('viewFor transmet msg avec la ligne, et seulement aux joueurs qui voient la ligne', () => {
    for (const p of ['p1', 'p2', 'p3']) {
      const v = viewFor(state, p)
      const visible = state.log.filter((l) => l.visibleTo === 'all' || l.visibleTo.includes(p)).slice(-v.log.length)
      expect(v.log.map((l) => l.msg)).toEqual(visible.map((l) => l.msg))
      for (const l of v.log) expect(formatLog(l, fr, 'fr', v, state.catalogs)).toBe(l.text)
    }
    expect(viewFor(state, 'p2').log.some((l) => l.msg?.key === 'seen')).toBe(false)
    expect(viewFor(state, 'p1').log.some((l) => l.msg?.key === 'seen')).toBe(true)
    expect(viewFor(state, 'p2').log.some((l) => l.msg?.key === 'revealedTo')).toBe(true)
  })

  it('sans msg (serveur plus ancien), clé inconnue ou joueur absent : la phrase française', () => {
    expect(formatLog({ text: 'Pioche 1 carte' }, en, 'en', view, state.catalogs)).toBe('Pioche 1 carte')
    const unknown = { text: 'nouvelle ligne', msg: { key: 'inconnue', params: {} } } as unknown as LogEntry
    expect(formatLog(unknown, en, 'en', view, state.catalogs)).toBe('nouvelle ligne')
    const proto = { text: 'ligne', msg: { key: 'constructor' } } as unknown as LogEntry
    expect(formatLog(proto, en, 'en', view, state.catalogs)).toBe('ligne')
    expect(formatLog({ text: 'Zoé est éliminé', msg: { key: 'eliminated', params: { p: { player: 'p9' } } } }, en, 'en', view, state.catalogs)).toBe('Zoé est éliminé')
  })

  it('msg compact : pas de valeur absente, pas de params vides', () => {
    for (const e of entries) {
      if (e.msg!.params) expect(Object.keys(e.msg!.params).length).toBeGreaterThan(0)
      for (const v of Object.values(e.msg!.params ?? {})) expect(v).not.toBeUndefined()
    }
    const keep = entries.find((e) => e.msg?.key === 'keep')!
    expect(keep.msg).toEqual({ key: 'keep' })
  })
})
