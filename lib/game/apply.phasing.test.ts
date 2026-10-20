import { fr } from '@/lib/i18n/messages'
import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { groupBattlefield } from './battlefield'
import { canApply } from './rules'
import { cardMenu } from './menus'
import { parseClientAction } from './validate'
import { viewFor } from './view'
import type { GameAction, GameState, VisibleCard } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const a = card('p1', 2)
const b = card('p1', 3)
const BF = { player: 'p1', zone: 'battlefield' } as const
const last = (s: GameState) => s.log[s.log.length - 1].text

function game(): GameState {
  const s = run(setupFor('commander', 2), start(1))
  return place(s, [
    { id: a, player: 'p1', zone: 'battlefield' },
    { id: b, player: 'p1', zone: 'battlefield' },
  ])
}
const shown = (s: GameState, viewer: string, id: string) =>
  viewFor(s, viewer).players.p1.zones.battlefield.find((v): v is VisibleCard => !v.hidden && v.id === id)!

describe('passer hors phase', () => {
  it('passe hors phase et revient, au journal ; la vue le montre à tous', () => {
    let s = applyAction(game(), { type: 'phase', actor: 'p2', id: a })
    expect(s.cards[a].phasedOut).toBe(true)
    expect(last(s)).toMatch(/hors phase/)
    expect(shown(s, 'p2', a)).toMatchObject({ phasedOut: true })
    expect(shown(s, 'p1', b).phasedOut).toBeUndefined()
    s = applyAction(s, { type: 'phase', actor: 'p1', id: a })
    expect(s.cards[a].phasedOut).toBeUndefined()
    expect(last(s)).toMatch(/revient en phase/)
  })

  it('garde son état (engagée, marqueurs) et le retrouve en revenant', () => {
    const s = apply(game(),
      { type: 'tap', actor: 'p1', id: a },
      { type: 'counter', actor: 'p1', id: a, kind: 'plus', delta: 2 },
      { type: 'phase', actor: 'p1', id: a },
      { type: 'phase', actor: 'p1', id: a })
    expect(s.cards[a]).toMatchObject({ tapped: true, counters: { plus: 2 } })
  })

  it('face cachée : le journal ne donne pas son nom', () => {
    const s = apply(game(), { type: 'faceDown', actor: 'p1', id: a }, { type: 'phase', actor: 'p1', id: a })
    expect(last(s)).toBe('une carte face cachée passe hors phase')
  })

  it('quitter le champ de bataille l’annule', () => {
    const s = apply(game(), { type: 'phase', actor: 'p1', id: a }, { type: 'move', actor: 'p1', id: a, to: { player: 'p1', zone: 'hand' } })
    expect(s.cards[a].phasedOut).toBeUndefined()
  })

  it('« Tout dégager » laisse engagés les permanents hors phase', () => {
    const s = apply(game(), { type: 'tap', actor: 'p1', id: a }, { type: 'tap', actor: 'p1', id: b }, { type: 'phase', actor: 'p1', id: a },
      { type: 'untapAll', actor: 'p1' })
    expect(s.cards[a].tapped).toBe(true)
    expect(s.cards[b].tapped).toBe(false)
  })

  it('au début de son tour, le contrôleur fait revenir ses permanents en phase, puis les dégage', () => {
    let s = apply(game(), { type: 'tap', actor: 'p1', id: a }, { type: 'phase', actor: 'p1', id: a })
    // Tour de l'adversaire : rien ne change.
    s = applyAction(s, { type: 'endTurn', actor: s.activePlayer })
    if (s.activePlayer !== 'p1') {
      expect(s.cards[a].phasedOut).toBe(true)
      s = applyAction(s, { type: 'endTurn', actor: s.activePlayer })
    }
    expect(s.activePlayer).toBe('p1')
    expect(s.cards[a].phasedOut).toBeUndefined()
    expect(s.cards[a].tapped).toBe(false)
  })

  it('possible sur le champ de bataille de n’importe qui, pas ailleurs', () => {
    expect(canApply(game(), { type: 'phase', actor: 'p2', id: a })).toBeNull()
    const s = applyAction(game(), { type: 'move', actor: 'p1', id: a, to: { player: 'p1', zone: 'hand' } })
    expect(canApply(s, { type: 'phase', actor: 'p1', id: a })).not.toBeNull()
  })

  it('action acceptée du navigateur', () => {
    expect(parseClientAction({ type: 'phase', id: a })).toEqual({ type: 'phase', id: a })
  })

  it('menu : « Passer hors phase » puis « Revenir en phase »', () => {
    const labels = (s: GameState, me: string) => {
      const view = viewFor(s, me)
      const entries = cardMenu({ view, me, catalogs: s.catalogs, lang: 'fr', t: fr, readOnly: false } as never, shown(s, me, a), BF)
      return entries.flatMap((e) => ('label' in e ? [e.label] : []))
    }
    expect(labels(game(), 'p1')).toContain('Passer hors phase')
    expect(labels(game(), 'p2')).toContain('Passer hors phase')
    expect(labels(applyAction(game(), { type: 'phase', actor: 'p1', id: a }), 'p1')).toContain('Revenir en phase')
  })

  it('pas empilée avec une carte identique en phase', () => {
    const s = applyAction(game(), { type: 'phase', actor: 'p1', id: a })
    const view = viewFor(s, 'p2')
    const rows = groupBattlefield(view.players.p1.zones.battlefield, s.catalogs)
    const stacks = [...rows.creatures, ...rows.others, ...rows.lands]
    expect(stacks.find((st) => st.cards.some((c) => c.id === a))!.count).toBe(1)
  })
})
