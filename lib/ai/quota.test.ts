import { describe, it, expect } from 'vitest'
import { parisDay } from './quota'

describe('parisDay', () => {
  it('donne le jour civil de Paris', () => {
    expect(parisDay(new Date('2026-10-13T12:00:00Z'))).toBe('2026-10-13')
  })

  it('passe au lendemain à minuit heure de Paris, pas à minuit UTC', () => {
    expect(parisDay(new Date('2026-10-13T21:59:00Z'))).toBe('2026-10-13')
    expect(parisDay(new Date('2026-10-13T22:00:00Z'))).toBe('2026-10-14')
    expect(parisDay(new Date('2026-10-13T23:30:00Z'))).toBe('2026-10-14')
  })

  it("suit l'heure d'hiver (UTC+1 après le 25 octobre 2026)", () => {
    expect(parisDay(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-26')
    expect(parisDay(new Date('2026-10-26T23:00:00Z'))).toBe('2026-10-27')
  })
})
