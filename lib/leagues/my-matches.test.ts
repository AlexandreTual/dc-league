import { describe, it, expect } from 'vitest'
import { calendarFor, isMyMatch } from './my-matches'

const m = (id: string, p1: string, p2: string, round: number, done = false) => ({
  id, player1_id: p1, player2_id: p2, round_number: round, is_completed: done,
})

const matches = [
  m('m1', 'ana', 'bob', 1, true),
  m('m2', 'chloe', 'emilie', 1),
  m('m3', 'emilie', 'ana', 2),
  m('m4', 'bob', 'chloe', 2),
  m('m5', 'bob', 'emilie', 3, true),
  m('m6', 'damien', 'emilie', 3),
]

describe('isMyMatch', () => {
  it('vrai si le joueur est player1_id ou player2_id', () => {
    expect(isMyMatch(matches[1], 'emilie')).toBe(true)
    expect(isMyMatch(matches[2], 'emilie')).toBe(true)
    expect(isMyMatch(matches[0], 'emilie')).toBe(false)
  })
})

describe('calendarFor', () => {
  it('le filtre « Mes matchs » ne garde que les matchs où le joueur est player1_id ou player2_id', () => {
    const view = calendarFor(matches, 'emilie', true)
    expect(view.shown.map((x) => x.id)).toEqual(['m2', 'm3', 'm5', 'm6'])
    expect(view.mineOnly).toBe(true)
  })

  it('« Tous » garde tous les matchs', () => {
    expect(calendarFor(matches, 'emilie', false).shown).toHaveLength(6)
  })

  it('un visiteur ne voit pas la bascule et le filtre est ignoré', () => {
    const view = calendarFor(matches, null, true)
    expect(view.showToggle).toBe(false)
    expect(view.mineOnly).toBe(false)
    expect(view.shown).toHaveLength(6)
    expect(view.remainingOpponents).toEqual([])
  })

  it('un connecté sans match dans la ligue ne voit pas la bascule', () => {
    const view = calendarFor(matches, 'inconnu', true)
    expect(view.showToggle).toBe(false)
    expect(view.mineOnly).toBe(false)
    expect(view.shown).toHaveLength(6)
  })

  it('un joueur inscrit voit la bascule et ses adversaires restants, dans l’ordre des rondes', () => {
    const view = calendarFor(matches, 'emilie', false)
    expect(view.showToggle).toBe(true)
    expect(view.remainingOpponents).toEqual(['chloe', 'ana', 'damien'])
  })
})
