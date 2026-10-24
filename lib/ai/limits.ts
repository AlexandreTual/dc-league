// Limites de l'assistant IA (spec 2026-10-13-ai-card-assistant-design).

export const AI_DAILY_QUOTA = 20
export const AI_MAX_CARDS = 10
export const AI_MAX_QUESTION_CHARS = 1000
/** Messages renvoyés à Gemini, nouvelle question comprise. */
export const AI_MAX_HISTORY = 10
/** Réponse de l'IA renvoyée dans l'historique (le panneau coupe au-delà, le serveur refuse). */
export const AI_MAX_ANSWER_CHARS = 8000
/** Taille totale des messages renvoyés (le panneau retire les plus anciens au-delà, le serveur refuse). */
export const AI_MAX_HISTORY_CHARS = 24_000
export const AI_TIMEOUT_MS = 30_000
export const AI_TIME_ZONE = 'Europe/Paris'
