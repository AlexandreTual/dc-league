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

const GOOGLE = { GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/abc/exec', GOOGLE_SCRIPT_SECRET: 'secret-google-789' }

function scriptFetch(body: unknown = { ok: true }, status = 200) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))
}

describe('choix du service', () => {
  it('script Google : adresse, en-têtes et corps exacts', async () => {
    const f = scriptFetch()
    const m = mailerFromEnv(GOOGLE, { fetch: f as typeof fetch })
    expect(await m.send(mail)).toBe('sent')
    const c = call(f)
    expect(c.url).toBe('https://script.google.com/macros/s/abc/exec')
    expect(c.init.method).toBe('POST')
    expect(c.init.redirect ?? 'follow').toBe('follow')
    expect(c.headers.get('content-type')).toBe('application/json')
    expect(c.body).toEqual({
      secret: 'secret-google-789',
      name: 'Commander League',
      to: 'ana@gmail.com',
      subject: 'Sujet',
      text: 'Texte',
      html: '<p>Texte</p>',
    })
  })

  it('script Google : MAIL_FROM inutile, MAIL_FROM_NAME pris en compte', async () => {
    const f = scriptFetch()
    await mailerFromEnv({ ...GOOGLE, MAIL_FROM_NAME: 'La Ligue' }, { fetch: f as typeof fetch }).send(mail)
    expect(call(f).body.name).toBe('La Ligue')
  })

  it('script Google : adresse ou mot de passe manquant → désactivé', async () => {
    const f = scriptFetch()
    expect(await mailerFromEnv({ GOOGLE_SCRIPT_URL: GOOGLE.GOOGLE_SCRIPT_URL }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
    expect(await mailerFromEnv({ GOOGLE_SCRIPT_SECRET: 's' }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
    expect(f).not.toHaveBeenCalled()
  })

  it('script Google : adresse hors de script.google.com → désactivé (le mot de passe ne part pas ailleurs)', async () => {
    const f = scriptFetch()
    for (const url of ['https://exemple.fr/exec', 'http://script.google.com/macros/s/abc/exec', 'https://script.google.com.evil.fr/x']) {
      expect(await mailerFromEnv({ ...GOOGLE, GOOGLE_SCRIPT_URL: url }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
    }
    expect(f).not.toHaveBeenCalled()
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

  it('Resend et script Google configurés : Resend (passage au domaine sans rien supprimer)', async () => {
    const f = okFetch()
    await mailerFromEnv({ ...GOOGLE, RESEND_API_KEY: 'r', MAIL_FROM: 'x@y.fr' }, { fetch: f as typeof fetch }).send(mail)
    expect(call(f).url).toBe('https://api.resend.com/emails')
  })

  it('Resend sans MAIL_FROM et script Google configuré : script Google', async () => {
    const f = scriptFetch()
    await mailerFromEnv({ ...GOOGLE, RESEND_API_KEY: 'r' }, { fetch: f as typeof fetch }).send(mail)
    expect(call(f).url).toBe(GOOGLE.GOOGLE_SCRIPT_URL)
  })

  it('MAIL_FROM_NAME pris en compte', async () => {
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
    expect(await mailerFromEnv({ RESEND_API_KEY: 'r' }, { fetch: f as typeof fetch }).send(mail)).toBe('disabled')
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
  const google = (f: unknown) =>
    mailerFromEnv({ ...GOOGLE, GOOGLE_SCRIPT_SECRET: 'cle-secrete-123' }, { fetch: f as typeof fetch })
  const resend = (f: unknown) => mailerFromEnv({ RESEND_API_KEY: 'cle-secrete-456', MAIL_FROM: 'x@y.fr' }, { fetch: f as typeof fetch })

  function journal() {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    return () => JSON.stringify(spy.mock.calls)
  }

  it.each([400, 401, 500])('réponse %i : failed, clé absente du journal', async (status) => {
    const logs = journal()
    const body = new Response('{"message":"Key cle-secrete-123 is invalid"}', { status })
    expect(await google(vi.fn(async () => body)).send(mail)).toBe('failed')
    expect(await resend(vi.fn(async () => new Response('cle-secrete-456', { status }))).send(mail)).toBe('failed')
    expect(logs()).not.toContain('cle-secrete')
    expect(logs()).toContain(String(status))
  })

  it('erreur réseau : failed, clé absente du journal', async () => {
    const logs = journal()
    const f = vi.fn(async () => {
      throw new Error('réseau coupé (cle-secrete-123)')
    })
    expect(await google(f).send(mail)).toBe('failed')
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

  it.each([
    ['refus du script', { ok: false, error: 'secret' }, 'secret'],
    ['quota Gmail atteint', { ok: false, error: 'quota' }, 'quota'],
  ])('script Google, %s : failed, raison journalisée sans le mot de passe', async (_cas, body, raison) => {
    const logs = journal()
    expect(await google(scriptFetch(body)).send(mail)).toBe('failed')
    expect(logs()).toContain(raison)
    expect(logs()).not.toContain('cle-secrete')
  })

  it('script Google, raison inattendue : non recopiée dans le journal', async () => {
    const logs = journal()
    expect(await google(scriptFetch({ ok: false, error: 'cle-secrete-123 <b>' })).send(mail)).toBe('failed')
    expect(logs()).not.toContain('cle-secrete')
  })

  it('script Google, page HTML au lieu de JSON (accès non public, erreur du script) : failed', async () => {
    const logs = journal()
    const f = vi.fn(async () => new Response('<html>Connexion Google</html>', { status: 200 }))
    expect(await google(f).send(mail)).toBe('failed')
    expect(logs()).toContain('google')
  })

  it('boîte de test en erreur : failed', async () => {
    journal()
    const db = { prepare: () => { throw new Error('no such table: test_mails') } } as unknown as D1Database
    expect(await mailerFromEnv({ MAIL_TEST: '1' }, { fetch: okFetch() as typeof fetch, db }).send(mail)).toBe('failed')
  })
})
