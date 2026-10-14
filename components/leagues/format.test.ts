import { describe, it, expect } from 'vitest'
import { organizerLabel, statusLabel } from './format'

describe('libellés de ligue', () => {
  it('organisateur', () => {
    expect(organizerLabel({ owner_name: 'Ana' })).toBe('Organisée par Ana')
    expect(organizerLabel({ owner_name: null })).toBe('Ligue du site')
  })

  it('état', () => {
    expect(statusLabel({ is_active: true, ended_at: null })).toBe('En cours')
    expect(statusLabel({ is_active: false, ended_at: '2026-05-03 10:00:00' })).toBe('Terminée le 3 mai 2026')
    expect(statusLabel({ is_active: false, ended_at: null })).toBe('Terminée')
  })
})
