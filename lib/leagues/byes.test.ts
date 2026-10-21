import { describe, it, expect } from 'vitest'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { byesByRound } from './byes'

describe('byesByRound', () => {
  it('5 inscrits : chaque ronde a exactement un exempt, et chaque joueur est exempt une fois', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const byes = byesByRound(ids, generateRoundRobinMatches(ids))
    expect([...byes.keys()].sort()).toEqual([1, 2, 3, 4, 5])
    for (const exempt of byes.values()) expect(exempt).toHaveLength(1)
    expect([...byes.values()].flat().sort()).toEqual(ids)
  })

  it('nombre pair d’inscrits : aucun exempt', () => {
    const ids = ['a', 'b', 'c', 'd']
    const byes = byesByRound(ids, generateRoundRobinMatches(ids))
    for (const exempt of byes.values()) expect(exempt).toEqual([])
  })

  it('garde l’ordre des inscrits et ignore ceux absents de tout le calendrier', () => {
    const matches = [
      { player1_id: 'a', player2_id: 'b', round_number: 1 },
      { player1_id: 'c', player2_id: 'a', round_number: 2 },
    ]
    const byes = byesByRound(['c', 'b', 'a', 'tard-venu'], matches)
    expect(byes.get(1)).toEqual(['c'])
    expect(byes.get(2)).toEqual(['b'])
  })
})
