import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, verifyDummyPassword, generateToken, hashToken } from './crypto'

describe('hashPassword / verifyPassword', () => {
  it('accepte le bon mot de passe', async () => {
    const h = await hashPassword('motdepasse1')
    expect(h).toMatch(/^pbkdf2\$100000\$[^$]+\$[^$]+$/)
    expect(await verifyPassword('motdepasse1', h)).toBe(true)
  })

  it('refuse un mauvais mot de passe', async () => {
    const h = await hashPassword('motdepasse1')
    expect(await verifyPassword('motdepasse2', h)).toBe(false)
  })

  it('utilise un sel différent à chaque hachage', async () => {
    expect(await hashPassword('xxxxxxxx')).not.toBe(await hashPassword('xxxxxxxx'))
  })

  it.each([null, '', 'bcrypt$1$a$b', 'pbkdf2$abc$a$b', 'pbkdf2$100000$a', 'pbkdf2$200000$YQ==$YQ=='])(
    'refuse un hachage invalide %s',
    async (s) => {
      expect(await verifyPassword('motdepasse1', s)).toBe(false)
    },
  )

  it('verifyDummyPassword se termine sans erreur', async () => {
    await expect(verifyDummyPassword('peu importe')).resolves.toBeUndefined()
  })
})

describe('jetons', () => {
  it('génère des jetons uniques en base64url de 43 caractères', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })

  it('hashToken est un SHA-256 hex stable', async () => {
    expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
