import { describe, it, expect } from 'vitest'
import type { GameTable } from '@/lib/db-games'
import { rematchOffer } from './rematch'

const table = (over: Partial<GameTable>): GameTable => ({
  id: 'r', hostPlayerId: 'p1', format: 'commander', seats: 4, eliminatedSeeAll: false, status: 'open', winnerPlayerId: null,
  durationSeconds: null, gameArchived: false, rematchTableId: null, createdAt: '', lastActivityAt: '',
  players: [{ playerId: 'p1', name: 'Ana', deckId: 'd1', deckName: 'D', seat: 1 }],
  ...over,
})

describe('rematchOffer', () => {
  it('sans revanche (ou introuvable) : rien, le bouton « Revanche » reste proposé', () => {
    expect(rematchOffer(null, 'p2')).toBeNull()
  })

  it('revanche ouverte où je ne suis pas : « Ana propose une revanche : Rejoindre »', () => {
    expect(rematchOffer(table({}), 'p2')).toEqual({ id: 'r', hostName: 'Ana', seated: false })
  })

  it('revanche où je suis déjà assis : un lien pour y retourner', () => {
    expect(rematchOffer(table({}), 'p1')).toEqual({ id: 'r', hostName: 'Ana', seated: true })
  })

  it('revanche commencée : lien seulement pour ses joueurs, rien pour les autres', () => {
    expect(rematchOffer(table({ status: 'playing' }), 'p1')).toEqual({ id: 'r', hostName: 'Ana', seated: true })
    expect(rematchOffer(table({ status: 'starting' }), 'p2')).toBeNull()
    expect(rematchOffer(table({ status: 'finished' }), 'p2')).toBeNull()
  })

  it('hôte absent de la liste : nom inconnu', () => {
    expect(rematchOffer(table({ hostPlayerId: 'p9' }), 'p2')?.hostName).toBe('?')
  })
})
