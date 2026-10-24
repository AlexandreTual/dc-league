import { describe, it, expect } from 'vitest'
import { historyChars, trimHistory } from './history'
import type { ChatMessage } from './types'

const user = (text: string): ChatMessage => ({ role: 'user', text })
const ai = (text: string): ChatMessage => ({ role: 'assistant', text })

describe('trimHistory', () => {
  it('garde une conversation courte telle quelle', () => {
    const messages = [user('a'), ai('y'.repeat(5000)), user('b')]
    expect(trimHistory(messages)).toEqual(messages)
  })

  it('garde les 10 derniers messages en commençant par une question', () => {
    const messages = Array.from({ length: 6 }, (_, i) => [user(`q${i}`), ai(`r${i}`)]).flat().concat(user('fin'))
    const kept = trimHistory(messages)
    expect(kept[0]).toEqual(user('q2'))
    expect(kept.at(-1)).toEqual(user('fin'))
    expect(kept).toHaveLength(9)
  })

  it('coupe une réponse trop longue et retire les plus anciens au-delà du total', () => {
    expect(trimHistory([user('a'), ai('x'.repeat(9000)), user('b')])[1].text).toHaveLength(8000)
    const heavy = Array.from({ length: 4 }, (_, i) => [user(`q${i}`), ai('y'.repeat(7000))]).flat().concat(user('fin'))
    const kept = trimHistory(heavy)
    expect(historyChars(kept)).toBeLessThanOrEqual(24_000)
    expect(kept[0]).toEqual(user('q1'))
    expect(kept.at(-1)).toEqual(user('fin'))
  })
})
