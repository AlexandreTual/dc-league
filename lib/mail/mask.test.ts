import { describe, it, expect } from 'vitest'
import { maskEmail } from './mask'

describe('maskEmail', () => {
  it('garde le premier caractère et le domaine', () => {
    expect(maskEmail('ana@gmail.com')).toBe('a…@gmail.com')
    expect(maskEmail('e@example.test')).toBe('e…@example.test')
  })
  it('adresse sans partie locale', () => {
    expect(maskEmail('@x.fr')).toBe('…')
    expect(maskEmail('abc')).toBe('…')
  })
})
