import { describe, it, expect } from 'vitest'
import { foldText } from './text'

describe('foldText', () => {
  it.each([
    ['Néron', 'neron'],
    ['NÉRON', 'neron'],
    ['être à l’île çà', 'etre a l\'ile ca'],
    ['Cœur', 'coeur'],
    ['ÆTHER', 'aether'],
    ['L’ange', 'l\'ange'],
    ['l‘ange lʼange', 'l\'ange l\'ange'],
    ['Lim-Dûl', 'lim-dul'],
    ['Sol Ring', 'sol ring'],
  ])('%s → %s', (text, expected) => {
    expect(foldText(text)).toBe(expected)
  })
})
