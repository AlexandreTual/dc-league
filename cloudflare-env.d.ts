interface CloudflareEnv extends Record<string, unknown> {
  DB: D1Database
  ADMIN_PASSWORD: string
}
