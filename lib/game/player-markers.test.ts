import { describe, it, expect } from 'vitest'
import { markerRows, newMarkerError, PRESET_MARKERS } from './player-markers'

const player = (over: Partial<{ poison: number; counters: Record<string, number>; commanderDamage: Record<string, number> }> = {}) =>
  ({ poison: 0, counters: {}, commanderDamage: {}, ...over })

describe('markerRows', () => {
  it('poison puis les marqueurs prédéfinis, même à 0', () => {
    expect(markerRows(player(), [])).toEqual([
      { kind: 'poison', key: 'poison', value: 0, alert: false },
      ...PRESET_MARKERS.map((name) => ({ kind: 'counter', key: `counter:${name}`, name, value: 0, preset: true })),
    ])
    expect(PRESET_MARKERS).toEqual(['Énergie', 'Expérience', 'Rad', 'Tickets'])
  })

  it('une ligne par commandant adverse connu, en alerte à 21', () => {
    const rows = markerRows(player({ commanderDamage: { c1: 21, c2: 4 } }), [{ id: 'c1', owner: 'p2' }, { id: 'c2', owner: 'p3' }, { id: 'c3', owner: 'p3' }])
    expect(rows.filter((r) => r.kind === 'commander')).toEqual([
      { kind: 'commander', key: 'commander:c1', commander: 'c1', owner: 'p2', value: 21, alert: true },
      { kind: 'commander', key: 'commander:c2', commander: 'c2', owner: 'p3', value: 4, alert: false },
      { kind: 'commander', key: 'commander:c3', commander: 'c3', owner: 'p3', value: 0, alert: false },
    ])
  })

  it('poison en alerte à 10', () => {
    expect(markerRows(player({ poison: 10 }), [])[0]).toMatchObject({ kind: 'poison', value: 10, alert: true })
  })

  it('marqueurs libres après les prédéfinis, sans doublon avec un prédéfini du même nom', () => {
    const rows = markerRows(player({ counters: { Rad: 3, 'Éclat': 2, 'énergie': 1 } }), [])
    const counters = rows.filter((r) => r.kind === 'counter')
    expect(counters).toEqual([
      // « énergie » (ancien compteur libre) prend la place du prédéfini « Énergie ».
      { kind: 'counter', key: 'counter:énergie', name: 'énergie', value: 1, preset: true },
      { kind: 'counter', key: 'counter:Expérience', name: 'Expérience', value: 0, preset: true },
      { kind: 'counter', key: 'counter:Rad', name: 'Rad', value: 3, preset: true },
      { kind: 'counter', key: 'counter:Tickets', name: 'Tickets', value: 0, preset: true },
      { kind: 'counter', key: 'counter:Éclat', name: 'Éclat', value: 2, preset: false },
    ])
  })

  it('un marqueur libre retombé à 0 reste listé', () => {
    expect(markerRows(player({ counters: { Éclat: 0 } }), []).some((r) => r.key === 'counter:Éclat')).toBe(true)
  })
})

describe('newMarkerError', () => {
  it('nom valide : aucune erreur', () => {
    expect(newMarkerError(player(), '  Éclat ')).toBeNull()
  })

  it('nom vide : rien à créer, sans message', () => {
    expect(newMarkerError(player(), '   ')).toBe('')
  })

  it('doublon d’un prédéfini ou d’un libre, sans tenir compte de la casse ni des accents', () => {
    expect(newMarkerError(player(), 'energie')).toBe('Le marqueur « Énergie » existe déjà.')
    expect(newMarkerError(player({ counters: { Éclat: 0 } }), 'ÉCLAT')).toBe('Le marqueur « Éclat » existe déjà.')
  })

  it('poison et blessures de commandant ne se créent pas comme marqueurs libres', () => {
    expect(newMarkerError(player(), 'Poison')).toBe('Le marqueur « Poison » existe déjà.')
  })

  it('nom trop long (40 caractères au plus)', () => {
    expect(newMarkerError(player(), 'x'.repeat(41))).toBe('Nom trop long (40 caractères au plus).')
  })
})
