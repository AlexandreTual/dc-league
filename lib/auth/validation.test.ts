import { describe, it, expect } from 'vitest'
import {
  validateUsername,
  validatePassword,
  loginHref,
  safeRedirectPath,
  normalizeEmail,
  validateEmail,
  requiredText,
  optionalText,
  requiredId,
  optionalDeckLink,
  optionalCardImage,
  optionalAvatar,
  DECK_LINK_ERROR,
  CARD_IMAGE_ERROR,
  AVATAR_ERROR,
} from './validation'

describe('requiredText', () => {
  it('retire les espaces', () => expect(requiredText('  Bob ', 'Le nom', 10)).toEqual({ ok: true, value: 'Bob' }))
  it.each([undefined, null, 123, '', '   ', {}])('refuse %s', (v) => {
    expect(requiredText(v, 'Le nom', 10)).toEqual({ ok: false, error: 'Le nom est requis' })
  })
  it('refuse un texte trop long', () => {
    expect(requiredText('x'.repeat(11), 'Le nom', 10)).toEqual({ ok: false, error: 'Le nom ne doit pas dépasser 10 caractères' })
  })
  it('accepte la longueur maximale', () => expect(requiredText('x'.repeat(10), 'Le nom', 10).ok).toBe(true))
})

describe('optionalText', () => {
  it('undefined = inchangé', () => expect(optionalText(undefined, 'Le nom', 10)).toEqual({ ok: true, value: undefined }))
  it('refuse un nombre', () => expect(optionalText(123, 'Le nom', 10).ok).toBe(false))
})

describe('requiredId', () => {
  it('accepte un identifiant', () => expect(requiredId('p1', "L'identifiant")).toEqual({ ok: true, value: 'p1' }))
  it.each([undefined, 12, '', 'x'.repeat(101)])('refuse %s', (v) => expect(requiredId(v, "L'identifiant").ok).toBe(false))
})

describe('optionalDeckLink', () => {
  it.each([
    'https://moxfield.com/decks/abc',
    'https://www.moxfield.com/decks/abc',
    'https://archidekt.com/decks/123',
    'https://www.archidekt.com/decks/123/nom',
  ])('accepte %s', (url) => expect(optionalDeckLink(url)).toEqual({ ok: true, value: url }))

  it.each([
    'http://moxfield.com/decks/abc',
    'javascript:alert(1)',
    'https://evil.com/decks/abc',
    'https://moxfield.com.evil.com/decks/abc',
    'https://evilmoxfield.com/decks/abc',
    'https://user:pass@moxfield.com/decks/abc',
    'moxfield.com/decks/abc',
    `https://moxfield.com/decks/${'a'.repeat(500)}`,
    42,
  ])('refuse %s', (url) => expect(optionalDeckLink(url)).toEqual({ ok: false, error: DECK_LINK_ERROR }))

  it('undefined = inchangé, vide ou null = effacé', () => {
    expect(optionalDeckLink(undefined)).toEqual({ ok: true, value: undefined })
    expect(optionalDeckLink('  ')).toEqual({ ok: true, value: null })
    expect(optionalDeckLink(null)).toEqual({ ok: true, value: null })
  })
})

describe('optionalCardImage', () => {
  it.each(['https://cards.scryfall.io/normal/front/a/b/ab.jpg', 'https://c1.scryfall.com/file/x.jpg'])('accepte %s', (url) => {
    expect(optionalCardImage(url)).toEqual({ ok: true, value: url })
  })
  it.each(['https://evil.com/x.jpg', 'http://cards.scryfall.io/x.jpg', 'data:image/png;base64,AAAA'])('refuse %s', (url) => {
    expect(optionalCardImage(url)).toEqual({ ok: false, error: CARD_IMAGE_ERROR })
  })
})

describe('optionalAvatar', () => {
  it('accepte une adresse https', () => expect(optionalAvatar(' https://img/a.png ')).toEqual({ ok: true, value: 'https://img/a.png' }))
  it.each(['http://img/a.png', 'javascript:x', 42, `https://${'a'.repeat(500)}`])('refuse %s', (v) => {
    expect(optionalAvatar(v)).toEqual({ ok: false, error: AVATAR_ERROR })
  })
  it('vide = effacé', () => expect(optionalAvatar('')).toEqual({ ok: true, value: null }))
})

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
    [null, '/salon'],
    [undefined, '/salon'],
    ['', '/salon'],
    ['//evil.com', '/salon'],
    ['https://evil.com', '/salon'],
    ['/\\evil.com', '/salon'],
    ['/\t/evil.com', '/salon'],
    ['/\n/evil.com', '/salon'],
    ['/\r/evil.com', '/salon'],
    ['/%09/evil.com', '/%09/evil.com'],
    ['/a\\b', '/salon'],
    ['/\u0000x', '/salon'],
    ['/\u007f', '/salon'],
    ['/admin', '/admin'],
    ['/profil/decks?x=1', '/profil/decks?x=1'],
  ])('safeRedirectPath(%s) = %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected)
  })
})

describe('loginHref', () => {
  it.each([
    ['/', '/connexion?from=%2F'],
    ['/calendar', '/connexion?from=%2Fcalendar'],
    ['/tables/abc', '/connexion?from=%2Ftables%2Fabc'],
    ['/connexion', '/connexion'],
    ['/invitation/jeton', '/connexion'],
    ['/mot-de-passe-oublie', '/connexion'],
    [null, '/connexion'],
  ])('loginHref(%s) = %s', (input, expected) => {
    expect(loginHref(input)).toBe(expected)
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
