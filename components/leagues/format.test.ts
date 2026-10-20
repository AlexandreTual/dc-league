import { describe, it, expect } from 'vitest'
import { en, fr } from '@/lib/i18n/messages'
import { leagueDate, organizerLabel, startedOrStatus, statusLabel } from './format'

describe('libellés de ligue', () => {
  it('organisateur', () => {
    expect(organizerLabel({ owner_name: 'Ana' }, fr)).toBe('Organisée par Ana')
    expect(organizerLabel({ owner_name: null }, fr)).toBe('Ligue du site')
  })

  it('état', () => {
    expect(statusLabel({ is_active: true, ended_at: null }, fr, 'fr')).toBe('En cours')
    expect(statusLabel({ is_active: false, ended_at: '2026-05-03 10:00:00' }, fr, 'fr')).toBe('Terminée le 3 mai 2026')
    expect(statusLabel({ is_active: false, ended_at: null }, fr, 'fr')).toBe('Terminée')
  })

  it('ligue en cours : date de début, sinon état', () => {
    expect(startedOrStatus({ is_active: true, ended_at: null, started_at: '2026-05-03 10:00:00' }, fr, 'fr')).toBe('Depuis le 3 mai 2026')
    expect(startedOrStatus({ is_active: false, ended_at: null, started_at: '2026-05-03 10:00:00' }, fr, 'fr')).toBe('Terminée')
  })

  it('en anglais', () => {
    expect(organizerLabel({ owner_name: 'Ana' }, en)).toBe('Run by Ana')
    expect(organizerLabel({ owner_name: null }, en)).toBe('Site league')
    expect(statusLabel({ is_active: true, ended_at: null }, en, 'en')).toBe('Ongoing')
    expect(statusLabel({ is_active: false, ended_at: '2026-05-03 10:00:00' }, en, 'en')).toBe('Finished on 3 May 2026')
    expect(statusLabel({ is_active: false, ended_at: null }, en, 'en')).toBe('Finished')
    expect(startedOrStatus({ is_active: true, ended_at: null, started_at: '2026-05-03 10:00:00' }, en, 'en')).toBe('Since 3 May 2026')
    expect(leagueDate('2026-05-03 10:00:00', 'en')).toBe('3 May 2026')
  })
})
