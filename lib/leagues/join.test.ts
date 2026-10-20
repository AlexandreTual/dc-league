import { describe, it, expect } from 'vitest'
import { inviteUrl, isLeagueInvitePath, joinBlock, joinRefusal, JOIN_TOO_LATE, LEAGUE_FINISHED } from './join'

describe('joinBlock', () => {
  it('raison du refus, clé du texte de la langue', () => {
    expect(joinBlock({ is_active: true }, 0)).toBeNull()
    expect(joinBlock({ is_active: true }, 3)).toBe('tooLate')
    expect(joinBlock({ is_active: false }, 0)).toBe('leagueFinished')
  })
})

describe('joinRefusal', () => {
  it('ligue en cours sans match : possible', () => {
    expect(joinRefusal({ is_active: true }, 0)).toBeNull()
  })
  it('matchs générés ou ligue terminée : refus', () => {
    expect(joinRefusal({ is_active: true }, 3)).toBe(JOIN_TOO_LATE)
    expect(joinRefusal({ is_active: false }, 0)).toBe(LEAGUE_FINISHED)
  })
})

describe('lien d’invitation', () => {
  it('adresse complète', () => {
    expect(inviteUrl('https://dc.example', 'abc123')).toBe('https://dc.example/ligues/rejoindre/abc123')
  })
  it('reconnaît une arrivée depuis un lien de ligue', () => {
    expect(isLeagueInvitePath('/ligues/rejoindre/abc')).toBe(true)
    expect(isLeagueInvitePath('/profil')).toBe(false)
    expect(isLeagueInvitePath(null)).toBe(false)
  })
})
