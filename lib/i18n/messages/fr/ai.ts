// Panneau de l'assistant IA (français, la référence). Les erreurs renvoyées par la route sont dans `errors`.
export const ai = {
  title: 'Assistant IA',
  newQuestion: 'Nouvelle question',
  noCard: 'Ajoute une carte depuis sa fiche « Oracle et règles » ou le menu d’une carte.',
  removeCard: (name: string) => `Retirer ${name}`,
  maxCards: (n: number) => `${n} cartes au plus`,
  thinking: 'L’IA réfléchit…',
  placeholder: 'Pose ta question…',
  questionLabel: 'Ta question',
  send: 'Envoyer',
  remaining: (n: number) => `${n} question${n > 1 ? 's' : ''} restante${n > 1 ? 's' : ''} aujourd’hui`,
  quotaReached: 'Plus de questions pour aujourd’hui, à demain !',
  disclaimer: 'Réponse générée par une IA : elle peut se tromper. Le texte Oracle et les règles font foi.',
  genericError: 'Une erreur est survenue',
  networkError: 'Erreur réseau',
  suggestions: {
    one: 'Explique cette carte',
    several: 'Comment ces cartes interagissent-elles ?',
  },
}
