import type { Messages } from '../fr'

export const ai: Messages['ai'] = {
  title: 'AI assistant',
  newQuestion: 'New question',
  noCard: 'Add a card from its “Oracle and rulings” sheet or from a card’s menu.',
  removeCard: (name: string) => `Remove ${name}`,
  maxCards: (n: number) => `${n} cards max`,
  thinking: 'The AI is thinking…',
  placeholder: 'Ask your question…',
  questionLabel: 'Your question',
  send: 'Send',
  remaining: (n: number) => `${n} question${n === 1 ? '' : 's'} left today`,
  quotaReached: 'No more questions today, see you tomorrow!',
  disclaimer: 'AI-generated answer: it can be wrong. The Oracle text and the rules are what count.',
  genericError: 'Something went wrong',
  networkError: 'Network error',
  suggestions: {
    one: 'Explain this card',
    several: 'How do these cards interact?',
  },
}
