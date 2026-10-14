// État du panneau de l'assistant IA (pur, testé) : cartes choisies, conversation, compteur.
import { AI_MAX_CARDS } from '@/lib/ai/limits'

export type AiCardRef = { oracleId: string; name: string; gathererUrl: string }

export type AiMessage =
  | { role: 'user'; text: string }
  /** cards : cartes de la question, pour les liens Gatherer sous la réponse. */
  | { role: 'assistant'; text: string; cards: AiCardRef[] }

export type AiState = {
  open: boolean
  cards: AiCardRef[]
  messages: AiMessage[]
  pending: boolean
  error: string | null
  notice: string | null
  remaining: number | null
}

export type AiAction =
  | { type: 'open'; card?: AiCardRef }
  | { type: 'close' }
  | { type: 'add'; card: AiCardRef }
  | { type: 'remove'; oracleId: string }
  | { type: 'send'; text: string }
  | { type: 'answer'; text: string; remaining: number }
  | { type: 'fail'; error: string; remaining?: number }
  | { type: 'reset' }
  | { type: 'quota'; remaining: number }

export const initialAiState: AiState = { open: false, cards: [], messages: [], pending: false, error: null, notice: null, remaining: null }

function addCard(state: AiState, card: AiCardRef): AiState {
  if (state.cards.some((c) => c.oracleId === card.oracleId)) return state
  if (state.cards.length >= AI_MAX_CARDS) return { ...state, notice: `${AI_MAX_CARDS} cartes au plus` }
  return { ...state, cards: [...state.cards, card], notice: null }
}

export function aiReducer(state: AiState, action: AiAction): AiState {
  switch (action.type) {
    case 'open': {
      const opened = { ...state, open: true }
      return action.card ? addCard(opened, action.card) : opened
    }
    case 'close':
      return { ...state, open: false }
    case 'add':
      return addCard({ ...state, open: true }, action.card)
    case 'remove':
      return { ...state, cards: state.cards.filter((c) => c.oracleId !== action.oracleId), notice: null }
    case 'send':
      return { ...state, messages: [...state.messages, { role: 'user', text: action.text }], pending: true, error: null }
    case 'answer':
      return {
        ...state,
        messages: [...state.messages, { role: 'assistant', text: action.text, cards: state.cards }],
        pending: false,
        remaining: action.remaining,
      }
    case 'fail': {
      // La question repart du fil (elle reste dans la zone de saisie, côté panneau).
      const messages = state.messages[state.messages.length - 1]?.role === 'user' ? state.messages.slice(0, -1) : state.messages
      return { ...state, messages, pending: false, error: action.error, remaining: action.remaining ?? state.remaining }
    }
    case 'reset':
      return { ...state, messages: [], error: null, pending: false }
    case 'quota':
      return { ...state, remaining: action.remaining }
  }
}

/** Question proposée selon le nombre de cartes choisies. */
export function suggestions(cardCount: number): string[] {
  if (cardCount === 0) return []
  return cardCount === 1 ? ['Explique cette carte'] : ['Comment ces cartes interagissent-elles ?']
}
