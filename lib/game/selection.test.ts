import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import type { MenuContext, MenuEntry } from './menus'
import { canSelectIn, liveSelection, rowPlaces, selectIds, selectionMenu, shiftedPlaces, toggleId } from './selection'
import { viewFor } from './view'

const field = [card('p1', 1), card('p1', 2), card('p1', 3, 1)]
const bf = { player: 'p1', zone: 'battlefield' as const }
const hand = { player: 'p1', zone: 'hand' as const }

function state() {
  return place(run(setupFor('commander', 2), start(1)), field.map((id) => ({ id, player: 'p1', zone: 'battlefield' as const })))
}
const ctx = (s = state(), me = 'p1'): MenuContext => ({ me, view: viewFor(s, me), catalogs: s.catalogs, lang: 'fr', readOnly: false })
const labels = (entries: MenuEntry[]) => entries.flatMap((e) => (e.kind === 'item' ? [e.label] : []))
const commands = (entries: MenuEntry[], label: string) => entries.flatMap((e) => (e.kind === 'item' && e.label === label ? e.commands : []))

describe('sélection', () => {
  it('seulement sur mon champ de bataille et ma main', () => {
    expect(canSelectIn('p1', bf)).toBe(true)
    expect(canSelectIn('p1', hand)).toBe(true)
    expect(canSelectIn('p1', { player: 'p2', zone: 'battlefield' })).toBe(false)
    expect(canSelectIn('p1', { player: 'p1', zone: 'graveyard' })).toBe(false)
    expect(canSelectIn(null, bf)).toBe(false)
  })

  it('garde les cartes encore là, dans l’ordre de la zone', () => {
    const s = state()
    const view = viewFor(s, 'p1')
    expect(liveSelection(view, { zone: bf, ids: [field[2], field[0]] })).toEqual({ zone: bf, ids: [field[0], field[2]] })
    const gone = viewFor(applyAction(s, { type: 'move', actor: 'p1', id: field[0], to: { player: 'p1', zone: 'graveyard' } }), 'p1')
    expect(liveSelection(gone, { zone: bf, ids: [field[0], field[2]] })).toEqual({ zone: bf, ids: [field[2]] })
    expect(liveSelection(gone, { zone: bf, ids: [field[0]] })).toBeNull()
    expect(liveSelection(view, null)).toBeNull()
  })

  it('rectangle : remplace, ou s’ajoute avec Maj dans la même zone ; Maj + clic ajoute ou retire', () => {
    const sel = selectIds(null, bf, [field[0]], false)
    expect(selectIds(sel, bf, [field[1], field[0]], true)).toEqual({ zone: bf, ids: [field[0], field[1]] })
    expect(selectIds(sel, bf, [field[1]], false)).toEqual({ zone: bf, ids: [field[1]] })
    expect(selectIds(sel, hand, ['h1'], true)).toEqual({ zone: hand, ids: ['h1'] })
    expect(selectIds(sel, bf, [], false)).toBeNull()
    expect(toggleId(sel, bf, field[1])).toEqual({ zone: bf, ids: [field[0], field[1]] })
    expect(toggleId(sel, bf, field[0])).toBeNull()
    expect(toggleId(sel, hand, 'h1')).toEqual({ zone: hand, ids: ['h1'] })
  })

  it('positions : décalage commun borné au champ, rangée centrée sur la carte tenue', () => {
    expect(shiftedPlaces([{ x: 10, y: 10 }, { x: 95, y: 50 }], 10, -20)).toEqual([{ x: 20, y: 0 }, { x: 100, y: 30 }])
    expect(rowPlaces(3, { x: 50, y: 40 })).toEqual([{ x: 41, y: 40 }, { x: 50, y: 40 }, { x: 59, y: 40 }])
    expect(rowPlaces(2, { x: 50, y: 40 }, 1)).toEqual([{ x: 41, y: 40 }, { x: 50, y: 40 }])
  })

  it('menu du groupe en jeu : engager, ranger (ordre choisi pour cimetière et bibliothèque), désélectionner', () => {
    const s = applyAction(state(), { type: 'tap', actor: 'p1', id: field[1] })
    const entries = selectionMenu(ctx(s), { zone: bf, ids: field })
    expect(entries[0]).toEqual({ kind: 'title', label: '3 cartes sélectionnées' })
    expect(labels(entries)).toEqual(['Engager', 'Dégager', 'Effet sur la sélection…', 'Main', 'Cimetière…', 'Exil', 'Dessus de la bibliothèque…', 'Dessous de la bibliothèque…', 'Tout désélectionner'])
    expect(commands(entries, 'Effet sur la sélection…')).toEqual([{ kind: 'effect', ids: field, title: '3 cartes sélectionnées' }])
    expect(commands(entries, 'Engager')).toEqual([field[0], field[2]].map((id) => ({ kind: 'action', action: { type: 'tap', id } })))
    expect(commands(entries, 'Dégager')).toEqual([{ kind: 'action', action: { type: 'tap', id: field[1] } }])
    expect(commands(entries, 'Exil')).toEqual([{ kind: 'action', action: { type: 'moveMany', ids: field, zone: 'exile' } }])
    expect(commands(entries, 'Cimetière…')).toEqual([{ kind: 'order', ids: field, zone: 'graveyard' }])
    expect(commands(entries, 'Dessous de la bibliothèque…')).toEqual([{ kind: 'order', ids: field, zone: 'library', position: 'bottom' }])
    expect(commands(entries, 'Tout désélectionner')).toEqual([{ kind: 'clearSelection' }])
  })

  it('menu du groupe en main : champ de bataille en rangée au centre, pas d’engagement', () => {
    const s = run(setupFor('commander', 2), start(1))
    const ids = s.players.p1.zones.hand.slice(0, 2)
    const entries = selectionMenu(ctx(s), { zone: hand, ids })
    expect(labels(entries)).toEqual(['Champ de bataille', 'Cimetière…', 'Exil', 'Dessus de la bibliothèque…', 'Dessous de la bibliothèque…', 'Tout désélectionner'])
    expect(commands(entries, 'Champ de bataille')).toEqual([{ kind: 'action', action: { type: 'moveMany', ids, zone: 'battlefield', places: rowPlaces(2, { x: 50, y: 50 }) } }])
  })

  it('aucun menu pour un spectateur, une partie finie ou une zone d’un autre', () => {
    expect(selectionMenu({ ...ctx(), readOnly: true }, { zone: bf, ids: field })).toEqual([])
    expect(selectionMenu(ctx(state(), 'p2'), { zone: bf, ids: field })).toEqual([])
  })
})
