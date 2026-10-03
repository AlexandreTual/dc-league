import { describe, it, expect } from 'vitest'
import { assertSameOrigin } from './origin'

const req = (origin?: string) =>
  new Request('https://league.example.com/api/auth/login', {
    method: 'POST',
    headers: origin ? { Origin: origin } : {},
  })

describe('assertSameOrigin', () => {
  it("accepte une requête sans en-tête Origin", () => {
    expect(assertSameOrigin(req())).toBeNull()
  })

  it('accepte la même origine', () => {
    expect(assertSameOrigin(req('https://league.example.com'))).toBeNull()
  })

  it('refuse une autre origine', async () => {
    const res = assertSameOrigin(req('https://evil.com'))
    expect(res?.status).toBe(403)
    expect(await res?.json()).toEqual({ error: 'Origine refusée' })
  })

  it('refuse une origine invalide', () => {
    expect(assertSameOrigin(req('null'))?.status).toBe(403)
  })
})
