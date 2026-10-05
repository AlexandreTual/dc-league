interface CloudflareEnv extends Record<string, unknown> {
  DB: D1Database
  GAME: DurableObjectNamespace
  ADMIN_PASSWORD: string
}
