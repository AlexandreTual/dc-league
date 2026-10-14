// Types de l'assistant IA.
import type { CardRow, Ruling } from '@/lib/cards/types'

/** Un message du chat, tel que le navigateur l'envoie. */
export type ChatMessage = { role: 'user' | 'assistant'; text: string }

/** Une carte jointe à la question : impressions anglaise et française, règles officielles. */
export type AiCard = { en: CardRow; fr: CardRow | null; rulings: Ruling[] }

/** Un message au format de l'API Gemini. */
export type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] }
