import { describe, it, expect } from 'vitest'
import type { DbPlayoff, PlayoffStage } from '@/lib/db'
import { playoffChampion } from './playoffs'

const match = (stage: PlayoffStage, p1: string, p2: string, score?: [number, number]): DbPlayoff => ({
  id: stage, stage, player1_id: p1, player2_id: p2,
  score_p1: score?.[0] ?? null, score_p2: score?.[1] ?? null, is_completed: !!score, created_at: '',
})

describe('playoffChampion', () => {
  const semi2 = match('semi2', 'b', 'c', [2, 1])

  it('vainqueur de la finale quand les deux demi-finales sont jouées', () => {
    expect(playoffChampion([match('semi1', 'a', 'd', [2, 0]), semi2, match('final', 'a', 'b', [1, 2])])).toBe('b')
  })

  it('aucun champion si une demi-finale n’est pas jouée', () => {
    expect(playoffChampion([match('semi1', 'a', 'd'), semi2, match('final', 'a', 'b', [2, 1])])).toBeNull()
  })

  it('aucun champion sans finale jouée', () => {
    expect(playoffChampion([match('semi1', 'a', 'd', [2, 0]), semi2, match('final', 'a', 'b')])).toBeNull()
    expect(playoffChampion([])).toBeNull()
  })
})
