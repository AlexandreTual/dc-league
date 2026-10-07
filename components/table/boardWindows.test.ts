import { describe, expect, it } from 'vitest'
import {
  BOARD_WINDOW_TIMEOUT_MS, boardWindowName, boardWindowUrl, channelName, detachedPlayers, isBoardWindowMessage, receive,
} from './boardWindows'

describe('adresses des fenêtres', () => {
  it('URL, nom de fenêtre et canal propres à la table et au joueur', () => {
    expect(boardWindowUrl('t1', 'e2e-2')).toBe('/tables/t1/plateau/e2e-2')
    expect(boardWindowUrl('t 1', 'a/b')).toBe('/tables/t%201/plateau/a%2Fb')
    expect(boardWindowName('e2e-2')).toBe('plateau-e2e-2')
    expect(channelName('t1')).toBe('dc-table-t1')
  })
})

describe('isBoardWindowMessage', () => {
  it('reconnaît les messages attendus', () => {
    expect(isBoardWindowMessage({ type: 'open', player: 'p2' })).toBe(true)
    expect(isBoardWindowMessage({ type: 'closed', player: 'p2' })).toBe(true)
    expect(isBoardWindowMessage({ type: 'return', player: 'p2' })).toBe(true)
    expect(isBoardWindowMessage({ type: 'hello' })).toBe(true)
  })
  it('rejette le reste', () => {
    expect(isBoardWindowMessage(null)).toBe(false)
    expect(isBoardWindowMessage('open')).toBe(false)
    expect(isBoardWindowMessage({ type: 'open' })).toBe(false)
    expect(isBoardWindowMessage({ type: 'open', player: 3 })).toBe(false)
    expect(isBoardWindowMessage({ type: 'autre', player: 'p2' })).toBe(false)
  })
})

describe('plateaux sortis', () => {
  it('un signal « ouverte » sort le plateau, « fermée » le ramène', () => {
    let state = receive({}, { type: 'open', player: 'p2' }, 1000)
    expect(detachedPlayers(state, 1000)).toEqual(['p2'])
    state = receive(state, { type: 'open', player: 'p3' }, 1500)
    expect(detachedPlayers(state, 1500)).toEqual(['p2', 'p3'])
    state = receive(state, { type: 'closed', player: 'p2' }, 2000)
    expect(detachedPlayers(state, 2000)).toEqual(['p3'])
  })

  it('« Ramener » remet le plateau sur la table sans attendre la fenêtre', () => {
    const state = receive(receive({}, { type: 'open', player: 'p2' }, 0), { type: 'return', player: 'p2' }, 10)
    expect(detachedPlayers(state, 10)).toEqual([])
  })

  it('sans signal pendant 5 s, le plateau revient', () => {
    const state = receive({}, { type: 'open', player: 'p2' }, 1000)
    expect(detachedPlayers(state, 1000 + BOARD_WINDOW_TIMEOUT_MS - 1)).toEqual(['p2'])
    expect(detachedPlayers(state, 1000 + BOARD_WINDOW_TIMEOUT_MS)).toEqual([])
  })

  it('chaque signal repousse l’expiration', () => {
    let state = receive({}, { type: 'open', player: 'p2' }, 0)
    state = receive(state, { type: 'open', player: 'p2' }, 4000)
    expect(detachedPlayers(state, 8000)).toEqual(['p2'])
  })

  it('« hello » ne change rien', () => {
    const state = receive({}, { type: 'open', player: 'p2' }, 0)
    expect(receive(state, { type: 'hello' }, 1)).toBe(state)
  })
})
