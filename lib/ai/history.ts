// Historique renvoyé à l'assistant : borné côté panneau pour que le serveur n'ait jamais à le refuser.
import { AI_MAX_ANSWER_CHARS, AI_MAX_HISTORY, AI_MAX_HISTORY_CHARS } from './limits'
import type { ChatMessage } from './types'

export function historyChars(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + m.text.length, 0)
}

/**
 * Les AI_MAX_HISTORY derniers messages, réponses coupées à AI_MAX_ANSWER_CHARS, les plus anciens retirés
 * tant que le total dépasse AI_MAX_HISTORY_CHARS ; le fil commence toujours par une question.
 */
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  let kept = messages
    .slice(-AI_MAX_HISTORY)
    .map((m) => (m.role === 'assistant' && m.text.length > AI_MAX_ANSWER_CHARS ? { ...m, text: m.text.slice(0, AI_MAX_ANSWER_CHARS) } : m))
  const start = () => {
    while (kept.length > 1 && kept[0].role !== 'user') kept = kept.slice(1)
  }
  start()
  while (kept.length > 1 && historyChars(kept) > AI_MAX_HISTORY_CHARS) {
    kept = kept.slice(1)
    start()
  }
  return kept
}
