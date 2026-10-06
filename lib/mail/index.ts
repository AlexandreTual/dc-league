import { insertTestMail } from '@/lib/db-auth'

export type Mail = { to: string; subject: string; text: string; html: string }
export type MailResult = 'sent' | 'failed' | 'disabled'
export type Mailer = { send(mail: Mail): Promise<MailResult> }
export type MailEnv = {
  BREVO_API_KEY?: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
  MAIL_FROM_NAME?: string
  MAIL_TEST?: string
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM_NAME = 'Commander League'
const SEND_TIMEOUT_MS = 10_000

export const disabledMailer: Mailer = { send: async () => 'disabled' }

const present = (s: string | undefined): string | null => (s && s.trim() ? s.trim() : null)

/**
 * Service choisi par la configuration : Brevo, sinon Resend, sinon boîte de test
 * (MAIL_TEST=1), sinon désactivé. Brevo et Resend exigent MAIL_FROM.
 */
export function mailerFromEnv(env: MailEnv, deps: { fetch: typeof fetch; db?: D1Database }): Mailer {
  const from = present(env.MAIL_FROM)
  const fromName = present(env.MAIL_FROM_NAME) ?? DEFAULT_FROM_NAME
  const brevoKey = present(env.BREVO_API_KEY)
  const resendKey = present(env.RESEND_API_KEY)

  if (brevoKey || resendKey) {
    if (!from) return disabledMailer
    if (brevoKey) {
      return {
        send: (mail) =>
          post(deps.fetch, 'brevo', BREVO_URL, { 'api-key': brevoKey }, {
            sender: { name: fromName, email: from },
            to: [{ email: mail.to }],
            subject: mail.subject,
            textContent: mail.text,
            htmlContent: mail.html,
          }),
      }
    }
    return {
      send: (mail) =>
        post(deps.fetch, 'resend', RESEND_URL, { Authorization: `Bearer ${resendKey}` }, {
          from: `${fromName} <${from}>`,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
    }
  }

  const db = deps.db
  if (env.MAIL_TEST === '1' && db) {
    return {
      send: async (mail) => {
        try {
          const { error } = await insertTestMail(db, { to: mail.to, subject: mail.subject, text: mail.text })
          if (error) throw new Error(error)
          return 'sent'
        } catch (e) {
          console.error('[mail] boîte de test :', (e as Error).message)
          return 'failed'
        }
      },
    }
  }
  return disabledMailer
}

/** Appel JSON avec délai maximal ; le journal ne contient ni la clé ni la réponse du service. */
async function post(
  fetchFn: typeof fetch,
  service: string,
  url: string,
  auth: Record<string, string>,
  body: unknown,
): Promise<MailResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.ok) return 'sent'
    console.error(`[mail] ${service} : réponse ${res.status}`)
    return 'failed'
  } catch (e) {
    const reason = controller.signal.aborted ? 'délai dépassé' : `erreur réseau (${(e as Error)?.name ?? 'inconnue'})`
    console.error(`[mail] ${service} : ${reason}`)
    return 'failed'
  } finally {
    clearTimeout(timer)
  }
}
