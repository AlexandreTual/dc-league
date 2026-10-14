import { insertTestMail } from '@/lib/db-auth'

export type Mail = { to: string; subject: string; text: string; html: string }
export type MailResult = 'sent' | 'failed' | 'disabled'
export type Mailer = { send(mail: Mail): Promise<MailResult> }
export type MailEnv = {
  GOOGLE_SCRIPT_URL?: string
  GOOGLE_SCRIPT_SECRET?: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
  MAIL_FROM_NAME?: string
  MAIL_TEST?: string
}

const RESEND_URL = 'https://api.resend.com/emails'
const GOOGLE_SCRIPT_ORIGIN = 'https://script.google.com'
const DEFAULT_FROM_NAME = 'Commander League'
const SEND_TIMEOUT_MS = 10_000
/** Raisons de refus renvoyées par scripts/google-apps-script-mail.js, seules recopiées dans le journal. */
const GOOGLE_REASONS = new Set(['secret', 'requete', 'quota', 'envoi'])

export const disabledMailer: Mailer = { send: async () => 'disabled' }

const present = (s: string | undefined): string | null => (s && s.trim() ? s.trim() : null)

/** Le mot de passe du script ne doit partir que vers script.google.com. */
function googleScriptUrl(s: string | undefined): string | null {
  const raw = present(s)
  if (!raw) return null
  try {
    return new URL(raw).origin === GOOGLE_SCRIPT_ORIGIN ? raw : null
  } catch {
    return null
  }
}

/**
 * Service choisi par la configuration : Resend (domaine), sinon script Google
 * (envoi depuis la Gmail du propriétaire, docs/mails.md), sinon boîte de test
 * (MAIL_TEST=1), sinon désactivé. Resend exige MAIL_FROM.
 */
export function mailerFromEnv(env: MailEnv, deps: { fetch: typeof fetch; db?: D1Database }): Mailer {
  const from = present(env.MAIL_FROM)
  const fromName = present(env.MAIL_FROM_NAME) ?? DEFAULT_FROM_NAME
  const resendKey = present(env.RESEND_API_KEY)
  const scriptUrl = googleScriptUrl(env.GOOGLE_SCRIPT_URL)
  const scriptSecret = present(env.GOOGLE_SCRIPT_SECRET)

  if (resendKey && from) {
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
  if (scriptUrl && scriptSecret) {
    return {
      send: (mail) =>
        post(
          deps.fetch,
          'google',
          scriptUrl,
          {},
          { secret: scriptSecret, name: fromName, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html },
          googleAccepted,
        ),
    }
  }
  if (resendKey) return disabledMailer

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

/**
 * Le script Google répond toujours 200 (après une redirection) : le résultat est dans
 * le corps, `{ ok: true }` ou `{ ok: false, error }`. Une page HTML (accès non public,
 * script en erreur) est un échec.
 */
async function googleAccepted(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { ok?: unknown; error?: unknown }
    if (body?.ok === true) return null
    return typeof body?.error === 'string' && GOOGLE_REASONS.has(body.error) ? `refus (${body.error})` : 'refus'
  } catch {
    return 'réponse illisible'
  }
}

/** Appel JSON avec délai maximal ; le journal ne contient ni la clé ni la réponse du service. */
async function post(
  fetchFn: typeof fetch,
  service: string,
  url: string,
  auth: Record<string, string>,
  body: unknown,
  /** Contrôle du corps d'une réponse 2xx : raison de l'échec, ou null si le mail est parti. */
  accepted?: (res: Response) => Promise<string | null>,
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
    if (res.ok) {
      const refusal = accepted ? await accepted(res) : null
      if (!refusal) return 'sent'
      console.error(`[mail] ${service} : ${refusal}`)
      return 'failed'
    }
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
