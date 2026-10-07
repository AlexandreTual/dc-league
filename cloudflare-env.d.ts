interface CloudflareEnv extends Record<string, unknown> {
  DB: D1Database
  GAME: DurableObjectNamespace
  ADMIN_PASSWORD: string
  BREVO_API_KEY?: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
  MAIL_FROM_NAME?: string
  MAIL_TEST?: string
}
