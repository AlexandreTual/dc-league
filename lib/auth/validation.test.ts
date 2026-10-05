import { describe, it, expect } from 'vitest'
import { validateUsername, validatePassword, safeRedirectPath } from './validation'

describe('validateUsername', () => {
  it.each(['al', 'a'.repeat(33), 'al ex', 'alex!', ''])('refuse %s', (s) => {
    expect(validateUsername(s)).not.toBeNull()
  })
  it.each(['alex', 'Alex_42', 'a.b-c', 'a'.repeat(32)])('accepte %s', (s) => {
    expect(validateUsername(s)).toBeNull()
  })
})

describe('validatePassword', () => {
  it('refuse moins de 8 caractères', () => expect(validatePassword('1234567')).not.toBeNull())
  it('accepte 8 caractères', () => expect(validatePassword('12345678')).toBeNull())
  it('accepte 200 caractères', () => expect(validatePassword('x'.repeat(200))).toBeNull())
  it('refuse plus de 200 caractères', () => expect(validatePassword('x'.repeat(201))).not.toBeNull())
})

describe('safeRedirectPath', () => {
  it.each([
    [null, '/profil'],
    [undefined, '/profil'],
    ['', '/profil'],
    ['//evil.com', '/profil'],
    ['https://evil.com', '/profil'],
    ['/\\evil.com', '/profil'],
    ['/admin', '/admin'],
    ['/profil/decks?x=1', '/profil/decks?x=1'],
  ])('safeRedirectPath(%s) = %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected)
  })
})
