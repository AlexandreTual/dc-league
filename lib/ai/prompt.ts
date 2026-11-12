// Consigne et contenu envoyés à Gemini : l'IA s'appuie sur les textes des cartes fournis, pas sur sa mémoire.
// La consigne suit la langue de l'interface du joueur ; le texte Oracle anglais fait toujours foi.
import { oracleFaces } from '@/lib/cards/oracle'
import type { Lang } from '@/lib/i18n/lang'
import { AI_MAX_HISTORY } from './limits'
import type { AiCard, ChatMessage, GeminiContent } from './types'

/** Langue de la réponse ; frenchNames : noms et textes français des cartes donnés (interface ou cartes en français). */
export type PromptOptions = { lang: Lang; frenchNames: boolean }

/** Réglage d'origine : tout en français. */
export const FRENCH: PromptOptions = { lang: 'fr', frenchNames: true }

const INSTRUCTION: Record<Lang, { head: string; names: string; plainNames: string; tail: string[] }> = {
  fr: {
    head: 'Tu es un arbitre de Magic: The Gathering, spécialiste du format Commander, qui aide des amis pendant leurs parties.',
    names: 'Réponds en français, simplement et sans jargon inutile, en citant les cartes par leurs noms français quand ils sont fournis (nom anglais entre parenthèses la première fois).',
    plainNames: 'Réponds en français, simplement et sans jargon inutile, en citant les cartes par leurs noms anglais.',
    tail: [
      'Appuie-toi d’abord sur le texte Oracle (anglais, il fait foi) et les règles officielles fournis pour chaque carte.',
      'Si ces textes ne suffisent pas pour trancher, dis-le clairement, puis indique la règle générale qui s’applique probablement, sans inventer de texte de carte ni de numéro de règle.',
      'Pour une interaction, décris les étapes dans l’ordre (pile, résolution, effets de remplacement ou déclenchés) et conclus par ce qui se passe concrètement.',
      'Reste sur Magic : refuse poliment les autres sujets.',
    ],
  },
  en: {
    head: 'You are a Magic: The Gathering judge, specialized in the Commander format, helping friends during their games.',
    names: 'Answer in English, simply and without needless jargon. The players see French card names: when a French name is given, add it in parentheses after the English name the first time.',
    plainNames: 'Answer in English, simply and without needless jargon, naming cards by their English names.',
    tail: [
      'Rely first on the Oracle text (it is authoritative) and the official rulings given for each card.',
      'If these texts are not enough to decide, say so clearly, then give the general rule that most likely applies, without making up card text or rule numbers.',
      'For an interaction, describe the steps in order (stack, resolution, replacement or triggered effects) and end with what concretely happens.',
      'Stay on Magic: politely decline other topics.',
    ],
  },
}

/** Consigne de l'arbitre dans la langue de l'interface. */
export function systemInstruction(lang: Lang, frenchNames: boolean = lang === 'fr'): string {
  const t = INSTRUCTION[lang]
  return [t.head, frenchNames ? t.names : t.plainNames, ...t.tail].join('\n')
}

const LABELS = {
  fr: {
    card: (n: number, title: string) => `### Carte ${n} : ${title}`,
    inFrench: (name: string, printed: string) => `${name} (en français : ${printed})`,
    face: (n: number, title: string) => `Face ${n} : ${title}`,
    cost: 'Coût : ',
    type: 'Type : ',
    oracle: 'Texte Oracle (anglais, fait foi) :',
    noText: '(aucun texte)',
    printed: 'Texte imprimé français :',
    noRulings: 'Règles officielles : Aucune règle publiée.',
    rulings: 'Règles officielles :',
    ruling: (date: string, text: string) => `- ${date} : ${text}`,
    cards: 'Cartes concernées :',
    question: 'Question :',
  },
  en: {
    card: (n: number, title: string) => `### Card ${n}: ${title}`,
    inFrench: (name: string, printed: string) => `${name} (French name: ${printed})`,
    face: (n: number, title: string) => `Face ${n}: ${title}`,
    cost: 'Mana cost: ',
    type: 'Type: ',
    oracle: 'Oracle text (authoritative):',
    noText: '(no text)',
    printed: 'Printed French text:',
    noRulings: 'Official rulings: None published.',
    rulings: 'Official rulings:',
    ruling: (date: string, text: string) => `- ${date}: ${text}`,
    cards: 'Cards in question:',
    question: 'Question:',
  },
}

function cardSection(card: AiCard, index: number, { lang, frenchNames }: PromptOptions): string {
  const t = LABELS[lang]
  const faces = oracleFaces(card.en, frenchNames ? card.fr : null)
  const enFaces = card.en.faces?.length ? card.en.faces : null
  const title = (name: string, printedName: string | null) => (printedName ? t.inFrench(name, printedName) : name)
  const lines = [t.card(index + 1, title(card.en.name, frenchNames ? card.fr?.printed_name ?? null : null))]

  faces.forEach((face, i) => {
    if (enFaces) lines.push(t.face(i + 1, title(face.name, face.printedName)))
    const cost = enFaces ? enFaces[i]?.mana_cost : card.en.mana_cost
    if (cost) lines.push(`${t.cost}${cost}`)
    lines.push(`${t.type}${face.typeLine}`)
    lines.push(`${t.oracle}\n${face.oracle ?? t.noText}`)
    if (face.printed) lines.push(`${t.printed}\n${face.printed}`)
  })

  if (card.rulings.length === 0) lines.push(t.noRulings)
  else lines.push(`${t.rulings}\n${card.rulings.map((r) => t.ruling(r.date, r.text)).join('\n')}`)
  return lines.join('\n')
}

/** Les cartes de la question, une section chacune. */
export function cardsBlock(cards: AiCard[], options: PromptOptions = FRENCH): string {
  return `${LABELS[options.lang].cards}\n\n${cards.map((c, i) => cardSection(c, i, options)).join('\n\n')}`
}

/**
 * Historique au format Gemini : les AI_MAX_HISTORY derniers messages, en commençant par une question,
 * le bloc des cartes placé en tête de la première (la question reste la dernière ligne).
 */
export function buildContents(cards: AiCard[], messages: ChatMessage[], options: PromptOptions = FRENCH): GeminiContent[] {
  let kept = messages.slice(-AI_MAX_HISTORY)
  while (kept.length > 0 && kept[0].role !== 'user') kept = kept.slice(1)
  return kept.map((m, i) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: i === 0 ? `${cardsBlock(cards, options)}\n\n${LABELS[options.lang].question}\n${m.text}` : m.text }],
  }))
}
