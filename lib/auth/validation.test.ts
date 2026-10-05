import { describe, it, expect } from 'vitest'
import { validateUsername, validatePassword, safeRedirectPath, normalizeEmail, validateEmail } from './validation'

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

describe('normalizeEmail', () => {
  it('retire les espaces', () => expect(normalizeEmail('  a@b.fr ')).toBe('a@b.fr'))
  it('vide → null', () => {
    expect(normalizeEmail('  ')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
  })
})

describe('validateEmail', () => {
  it.each(['ana@gmail.com', 'a.b+c@sub.example.fr'])('accepte %s', (s) => expect(validateEmail(s)).toBeNull())
  it.each(['ana', 'ana@', 'a@b', 'a b@c.fr', 'a@@b.fr', '@b.fr', `${'a'.repeat(250)}@b.fr`])('refuse %s', (s) => {
    expect(validateEmail(s)).toBe('Adresse mail invalide')
  })
})
