import { describe, it, expect } from 'vitest'
import { aiReducer, initialAiState, suggestions, type AiCardRef, type AiState } from './state'

const card = (i: number): AiCardRef => ({ oracleId: `o${i}`, name: `Carte ${i}`, gathererUrl: `https://gatherer/${i}` })
const run = (state: AiState, ...actions: Parameters<typeof aiReducer>[1][]) => actions.reduce(aiReducer, state)

describe('assistant IA : état du panneau', () => {
  it('ouvre le panneau, avec une carte si fournie, sans doublon', () => {
    const s = run(initialAiState, { type: 'open', card: card(1) }, { type: 'add', card: card(1) }, { type: 'add', card: card(2) })
    expect(s.open).toBe(true)
    expect(s.cards.map((c) => c.oracleId)).toEqual(['o1', 'o2'])
    expect(run(initialAiState, { type: 'open' }).cards).toEqual([])
  })

  it('refuse une 11e carte avec un message', () => {
    let s = initialAiState
    for (let i = 1; i <= 10; i++) s = aiReducer(s, { type: 'add', card: card(i) })
    s = aiReducer(s, { type: 'add', card: card(11) })
    expect(s.cards).toHaveLength(10)
    expect(s.notice).toBe('10 cartes au plus')
    expect(aiReducer(s, { type: 'remove', oracleId: 'o3' }).notice).toBeNull()
  })

  it('retire une carte', () => {
    const s = run(initialAiState, { type: 'add', card: card(1) }, { type: 'add', card: card(2) }, { type: 'remove', oracleId: 'o1' })
    expect(s.cards.map((c) => c.oracleId)).toEqual(['o2'])
  })

  it('envoie, reçoit la réponse avec les liens des cartes, met à jour le compteur', () => {
    let s = run(initialAiState, { type: 'add', card: card(1) }, { type: 'send', text: 'Explique' })
    expect(s.pending).toBe(true)
    expect(s.messages).toEqual([{ role: 'user', text: 'Explique' }])
    s = aiReducer(s, { type: 'answer', text: 'Réponse', remaining: 19 })
    expect(s.pending).toBe(false)
    expect(s.remaining).toBe(19)
    expect(s.messages[1]).toEqual({ role: 'assistant', text: 'Réponse', cards: [card(1)] })
  })

  it('en cas d’erreur, retire la question du fil et affiche l’erreur', () => {
    const s = run(initialAiState, { type: 'add', card: card(1) }, { type: 'send', text: 'Q' }, { type: 'fail', error: 'Oups', remaining: 0 })
    expect(s.messages).toEqual([])
    expect(s.error).toBe('Oups')
    expect(s.remaining).toBe(0)
    expect(s.pending).toBe(false)
    expect(aiReducer(s, { type: 'send', text: 'Q2' }).error).toBeNull()
  })

  it('« Nouvelle question » vide la conversation et garde les cartes', () => {
    const s = run(initialAiState, { type: 'add', card: card(1) }, { type: 'send', text: 'Q' }, { type: 'answer', text: 'R', remaining: 19 }, { type: 'reset' })
    expect(s.messages).toEqual([])
    expect(s.cards).toHaveLength(1)
  })

  it('fermer garde la conversation', () => {
    const s = run(initialAiState, { type: 'add', card: card(1) }, { type: 'send', text: 'Q' }, { type: 'answer', text: 'R', remaining: 19 }, { type: 'close' })
    expect(s.open).toBe(false)
    expect(s.messages).toHaveLength(2)
  })

  it('propose une question selon le nombre de cartes', () => {
    expect(suggestions(0)).toEqual([])
    expect(suggestions(1)).toEqual(['Explique cette carte'])
    expect(suggestions(3)).toEqual(['Comment ces cartes interagissent-elles ?'])
  })
})
