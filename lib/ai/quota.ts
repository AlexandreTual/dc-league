// Jour du quota de l'assistant IA : jour civil de Paris, remis à zéro à minuit.
import { AI_TIME_ZONE } from './limits'

const dayFormat = new Intl.DateTimeFormat('fr-CA', { timeZone: AI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** 'AAAA-MM-JJ' du jour à Paris. */
export function parisDay(now: Date): string {
  return dayFormat.format(now)
}
