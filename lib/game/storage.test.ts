import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { testDeckCards } from '@/test/factories'
import { buildCatalog } from './catalog'
import { clearGame, loadGame, saveGame } from './storage'
import type { GameAction } from './types'

const { catalog } = buildCatalog('d1', testDeckCards())
const list: GameAction[] = [{ type: 'start', seed: 1 }, { type: 'draw', count: 1 }]

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

let storage: ReturnType<typeof memoryStorage>
beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

describe('sauvegarde', () => {
  it('fait l’aller-retour', () => {
    saveGame(catalog, list)
    expect(JSON.parse(storage.data.get('dc-playtest-d1')!)).toEqual({ version: 1, fingerprint: catalog.fingerprint, actions: list })
    expect(loadGame(catalog)).toEqual(list)
  })

  it('ignore une sauvegarde d’une autre version du deck', () => {
    saveGame(catalog, list)
    expect(loadGame({ ...catalog, fingerprint: 'autre' })).toBeNull()
  })

  it('ignore une sauvegarde illisible ou d’une autre version de format', () => {
    storage.data.set('dc-playtest-d1', '{pas du json')
    expect(loadGame(catalog)).toBeNull()
    storage.data.set('dc-playtest-d1', JSON.stringify({ version: 2, fingerprint: catalog.fingerprint, actions: list }))
    expect(loadGame(catalog)).toBeNull()
  })

  it('renvoie null s’il n’y a rien', () => {
    expect(loadGame(catalog)).toBeNull()
  })

  it('clearGame efface la sauvegarde', () => {
    saveGame(catalog, list)
    clearGame('d1')
    expect(loadGame(catalog)).toBeNull()
  })

  it('survit à un stockage qui lève des exceptions', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqué') },
      setItem: () => { throw new Error('plein') },
      removeItem: () => { throw new Error('bloqué') },
    })
    expect(loadGame(catalog)).toBeNull()
    expect(() => saveGame(catalog, list)).not.toThrow()
    expect(() => clearGame('d1')).not.toThrow()
  })
})
