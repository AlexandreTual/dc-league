import { describe, it, expect, vi, afterEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { listTestMails } from '@/lib/db-auth'
import { disabledMailer, mailerFromEnv, type Mail } from './index'

const mail: Mail = { to: 'ana@gmail.com', subject: 'Sujet', text: 'Texte', html: '<p>Texte</p>' }

function okFetch(status = 200) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status }))
}

function call(f: ReturnType<typeof okFetch>) {
  const [url, init] = f.mock.calls[0]
  return { url: String(url), init: init as RequestInit, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('choix du service', () => {
  it('Brevo : adresse, en-têtes et corps exacts', async () => {
    const f = okFetch(201)
    const m = mailerFromEnv({ BREVO_API_KEY: 'cle-brevo', MAIL_FROM: 'ligue@gmail.com' }, { fetch: f as typeof fetch })
    expect(await m.send(mail)).toBe('sent')
    const c = call(f)
    expect(c.url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(c.init.method).toBe('POST')
    expect(c.headers.get('api-key')).toBe('cle-brevo')
    expect(c.headers.get('content-type')).toBe('application/json')
    expect(c.body).toEqual({
      sender: { name: 'Commander League', email: 'ligue@gmail.com' },
      to: [{ email: 'ana@gmail.com' }],
      subject: 'Sujet',
      textContent: 'Texte',
      htmlContent: '<p>Texte</p>',
    })
  })

  it('Resend : adresse, en-têtes et corps exacts', async () => {
    const f = okFetch()
    const m = mailerFromEnv({ RESEND_API_KEY: 'cle-resend', MAIL_FROM: 'ligue@exemple.fr' }, { fetch: f as typeof fetch })
    expect(await m.send(mail)).toBe('sent')
    const c = call(f)
    expect(c.url).toBe('https://api.resend.com/emails')
    expect(c.init.method).toBe('POST')
    expect(c.headers.get('authorization')).toBe('Bearer cle-resend')
    expect(c.headers.get('content-type')).toBe('application/json')
    expect(c.body).toEqual({
      from: 'Commander League <ligue@exemple.fr>',
      to: ['ana@gmail.com'],
      subject: 'Sujet',
      text: 'Texte',
      html: '<p>Texte</p>',
    })
  })

  it('les deux clés : Brevo', async () => {
    const f = okFetch()
    await mailerFromEnv({ BREVO_API_KEY: 'b', RESEND_API_KEY: 'r', MAIL_FROM: 'x@y.fr' }, { fetch: f as typeof fetch }).send(mail)
    expect(call(f).url).toBe('https://api.brevo.com/v3/smtp/email')
  })

  it('MAIL_FROM_NAME pris en compte', async () => {
    const f = okFetch()
    await mailerFromEnv({ BREVO_API_KEY: 'b', MAIL_FROM: 'x@y.fr', MAIL_FROM_NAME: 'La Ligue' }, { fetch: f as typeof fetch }).send(mail)
    expect(call(f).body.sender).toEqual({ name: 'La Ligue', email: 'x@y.fr' })
    const g = okFetch()
    await mailerFromEnv({ RESEND_API_KEY: 'r', MAIL_FROM: 'x@y.fr', MAIL_FROM_NAME: 'La Ligue' }, { fetch: g as typeof fetch }).send(mail)
    expect(call(g).body.from).toBe('La Ligue <x@y.fr>')
  })

  it('aucune clé : désactivé, sans appel', async () => {
    const f = okFetch()
    expect(await mailerFromEnv({ MAIL_FROM: 'x@y.fr' }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
    expect(f).not.toHaveBeenCalled()
  })

  it('clé sans MAIL_FROM : désactivé', async () => {
    const f = okFetch()
    expect(await mailerFromEnv({ BREVO_API_KEY: 'b' }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
    expect(await mailerFromEnv({ RESEND_API_KEY: 'r', MAIL_FROM: '  ' }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
    expect(f).not.toHaveBeenCalled()
  })

  it('MAIL_TEST=1 sans clé : mail écrit dans la boîte de test', async () => {
    const db = createTestDb()
    const f = okFetch()
    expect(await mailerFromEnv({ MAIL_TEST: '1' }, { fetch: f as typeof fetch, db }).send(mail)).toBe('sent')
    expect(f).not.toHaveBeenCalled()
    const { data } = await listTestMails(db)
    expect(data).toHaveLength(1)
    expect(data?.[0]).toMatchObject({ to: 'ana@gmail.com', subject: 'Sujet', text: 'Texte' })
  })

  it('MAIL_TEST=1 sans base : désactivé', async () => {
    expect(await mailerFromEnv({ MAIL_TEST: '1' }, { fetch: okFetch() as typeof fetch }).send(mail)).toBe('disabled')
  })

  it('MAIL_TEST autre que 1 : désactivé', async () => {
    expect(await mailerFromEnv({ MAIL_TEST: '0' }, { fetch: okFetch() as typeof fetch, db: createTestDb() }).send(mail)).toBe('disabled')
  })

  it('disabledMailer renvoie toujours disabled', async () => {
    expect(await disabledMailer.send(mail)).toBe('disabled')
  })
})

describe('échecs', () => {
  const brevo = (f: unknown) => mailerFromEnv({ BREVO_API_KEY: 'cle-secrete-123', MAIL_FROM: 'x@y.fr' }, { fetch: f as typeof fetch })
  const resend = (f: unknown) => mailerFromEnv({ RESEND_API_KEY: 'cle-secrete-456', MAIL_FROM: 'x@y.fr' }, { fetch: f as typeof fetch })

  function journal() {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    return () => JSON.stringify(spy.mock.calls)
  }

  it.each([400, 401, 500])('réponse %i : failed, clé absente du journal', async (status) => {
    const logs = journal()
    const body = new Response('{"message":"Key cle-secrete-123 is invalid"}', { status })
    expect(await brevo(vi.fn(async () => body)).send(mail)).toBe('failed')
    expect(await resend(vi.fn(async () => new Response('cle-secrete-456', { status }))).send(mail)).toBe('failed')
    expect(logs()).not.toContain('cle-secrete')
    expect(logs()).toContain(String(status))
  })

  it('erreur réseau : failed, clé absente du journal', async () => {
    const logs = journal()
    const f = vi.fn(async () => {
      throw new Error('réseau coupé (cle-secrete-123)')
    })
    expect(await brevo(f).send(mail)).toBe('failed')
    expect(logs()).not.toContain('cle-secrete')
  })

  it('délai dépassé (10 s) : failed', async () => {
    vi.useFakeTimers()
    journal()
    let signal: AbortSignal | undefined
    const f = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = resend(f).send(mail)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(signal?.aborted).toBe(true)
    expect(await pending).toBe('failed')
  })

  it('boîte de test en erreur : failed', async () => {
    journal()
    const db = { prepare: () => { throw new Error('no such table: test_mails') } } as unknown as D1Database
    expect(await mailerFromEnv({ MAIL_TEST: '1' }, { fetch: okFetch() as typeof fetch, db }).send(mail)).toBe('failed')
  })
})
