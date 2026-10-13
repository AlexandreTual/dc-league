interface CloudflareEnv extends Record<string, unknown> {
  DB: D1Database
  GAME: DurableObjectNamespace
  ADMIN_PASSWORD: string
  /** Assistant IA (docs/assistant-ia.md) : sans clé, la fonction est masquée. */
  GEMINI_API_KEY?: string
  /** Modèle Gemini, facultatif (par défaut DEFAULT_GEMINI_MODEL dans lib/ai/gemini.ts). */
  GEMINI_MODEL?: string
  /** Adresse de l'API Gemini, réservée aux tests (faux serveur local). */
  GEMINI_BASE_URL?: string
}
