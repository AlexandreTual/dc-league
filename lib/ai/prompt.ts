// Consigne et contenu envoyés à Gemini : l'IA s'appuie sur les textes des cartes fournis, pas sur sa mémoire.
import { oracleFaces } from '@/lib/cards/oracle'
import { AI_MAX_HISTORY } from './limits'
import type { AiCard, ChatMessage, GeminiContent } from './types'

export const SYSTEM_INSTRUCTION = [
  'Tu es un arbitre de Magic: The Gathering, spécialiste du format Commander, qui aide des amis pendant leurs parties.',
  'Réponds en français, simplement et sans jargon inutile, en citant les cartes par leurs noms français quand ils sont fournis (nom anglais entre parenthèses la première fois).',
  'Appuie-toi d’abord sur le texte Oracle (anglais, il fait foi) et les règles officielles fournis pour chaque carte.',
  'Si ces textes ne suffisent pas pour trancher, dis-le clairement, puis indique la règle générale qui s’applique probablement, sans inventer de texte de carte ni de numéro de règle.',
  'Pour une interaction, décris les étapes dans l’ordre (pile, résolution, effets de remplacement ou déclenchés) et conclus par ce qui se passe concrètement.',
  'Reste sur Magic : refuse poliment les autres sujets.',
].join('\n')

function cardSection(card: AiCard, index: number): string {
  const faces = oracleFaces(card.en, card.fr)
  const enFaces = card.en.faces?.length ? card.en.faces : null
  const title = (name: string, printedName: string | null) => (printedName ? `${name} (en français : ${printedName})` : name)
  const lines = [`### Carte ${index + 1} : ${title(card.en.name, card.fr?.printed_name ?? null)}`]

  faces.forEach((face, i) => {
    if (enFaces) lines.push(`Face ${i + 1} : ${title(face.name, face.printedName)}`)
    const cost = enFaces ? enFaces[i]?.mana_cost : card.en.mana_cost
    if (cost) lines.push(`Coût : ${cost}`)
    lines.push(`Type : ${face.typeLine}`)
    lines.push(`Texte Oracle (anglais, fait foi) :\n${face.oracle ?? '(aucun texte)'}`)
    if (face.printed) lines.push(`Texte imprimé français :\n${face.printed}`)
  })

  if (card.rulings.length === 0) lines.push('Règles officielles : Aucune règle publiée.')
  else lines.push(`Règles officielles :\n${card.rulings.map((r) => `- ${r.date} : ${r.text}`).join('\n')}`)
  return lines.join('\n')
}

/** Les cartes de la question, une section chacune. */
export function cardsBlock(cards: AiCard[]): string {
  return `Cartes concernées :\n\n${cards.map(cardSection).join('\n\n')}`
}

/**
 * Historique au format Gemini : les AI_MAX_HISTORY derniers messages, en commençant par une question,
 * le bloc des cartes placé en tête de la première.
 */
export function buildContents(cards: AiCard[], messages: ChatMessage[]): GeminiContent[] {
  let kept = messages.slice(-AI_MAX_HISTORY)
  while (kept.length > 0 && kept[0].role !== 'user') kept = kept.slice(1)
  return kept.map((m, i) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: i === 0 ? `${cardsBlock(cards)}\n\nQuestion :\n${m.text}` : m.text }],
  }))
}
