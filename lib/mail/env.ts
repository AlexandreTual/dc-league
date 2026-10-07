import { getRequestContext } from '@cloudflare/next-on-pages'
import type { MailContext } from '@/lib/auth/service'
import { mailerFromEnv } from './index'

/** Service d'envoi lu dans la configuration Cloudflare ; liens construits sur l'origine de la requête. */
export function mailContext(req: Request): MailContext {
  const { env } = getRequestContext<CloudflareEnv>()
  return { mailer: mailerFromEnv(env, { fetch: (input, init) => fetch(input, init), db: env.DB }), baseUrl: new URL(req.url).origin }
}
