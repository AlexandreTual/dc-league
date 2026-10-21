import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createHoverStore, useHovered } from './hover'

describe('createHoverStore (carte survolée)', () => {
  it('ne survole rien au départ, puis garde la dernière carte survolée', () => {
    const store = createHoverStore()
    expect(store.get()).toBeNull()
    store.set('c1')
    expect(store.get()).toBe('c1')
    store.set(null)
    expect(store.get()).toBeNull()
  })

  it('prévient les abonnés seulement quand la carte change', () => {
    const store = createHoverStore()
    const seen: (string | null)[] = []
    const stop = store.subscribe(() => seen.push(store.get()))
    store.set('c1')
    store.set('c1')
    store.set('c2')
    store.set(null)
    store.set(null)
    stop()
    store.set('c3')
    expect(seen).toEqual(['c1', 'c2', null])
  })

  it('se lit dans un composant (aperçu) sans passer par l’état de la table', () => {
    const store = createHoverStore()
    store.set('c7')
    function Reader() {
      return createElement('span', null, useHovered(store) ?? 'rien')
    }
    expect(renderToString(createElement(Reader))).toContain('c7')
  })
})
