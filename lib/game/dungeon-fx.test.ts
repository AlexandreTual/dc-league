import { describe, it, expect } from 'vitest'
import { dungeonFx, mapPoint, trackPoint } from './dungeon-fx'

describe('dungeonFx', () => {
  it('rien sans changement (premier affichage compris)', () => {
    const at = { position: { id: 'phandelver', room: 'cave' } as const, done: 0 }
    expect(dungeonFx(at, at)).toBeNull()
  })

  it('le jeton avance dans le même donjon : il glisse, la salle s’allume', () => {
    expect(dungeonFx({ position: { id: 'phandelver', room: 'cave' }, done: 0 }, { position: { id: 'phandelver', room: 'darkPool' }, done: 0 }))
      .toEqual({ glide: true, finish: false, room: 'darkPool' })
  })

  it('entrée dans un donjon, ou nouveau donjon après un terminé : pas de glissement', () => {
    expect(dungeonFx({ done: 0 }, { position: { id: 'undercity', room: 'secret' }, done: 0 })).toEqual({ glide: false, finish: false, room: 'secret' })
    expect(dungeonFx({ position: { id: 'phandelver', room: 'temple' }, done: 1 }, { position: { id: 'phandelver', room: 'cave' }, done: 1 }))
      .toEqual({ glide: false, finish: false, room: 'cave' })
  })

  it('dernière salle atteinte : éclat « Donjon terminé »', () => {
    expect(dungeonFx({ position: { id: 'annihilation', room: 'oubliette' }, done: 0 }, { position: { id: 'annihilation', room: 'cradle' }, done: 1 }))
      .toEqual({ glide: true, finish: true, room: 'cradle' })
  })
})

describe('positions', () => {
  it('piste du portrait : de 0 (entrée) à 100 (dernier étage)', () => {
    expect(trackPoint({ id: 'phandelver', room: 'cave' })).toBe(0)
    expect(trackPoint({ id: 'phandelver', room: 'temple' })).toBe(100)
    expect(trackPoint({ id: 'madMage', room: 'lostLevel' })).toBe(50)
  })

  it('plan : centre de la salle en % du plan', () => {
    expect(mapPoint({ id: 'phandelver', room: 'cave' })).toEqual({ x: 50, y: 12.5 })
    expect(mapPoint({ id: 'undercity', room: 'stash' })).toEqual({ x: 83, y: 50 })
  })
})
