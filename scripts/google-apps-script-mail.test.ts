import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const SOURCE = readFileSync(path.join(__dirname, 'google-apps-script-mail.js'), 'utf8')
const SECRET = 'mot-de-passe-de-test-123'

/** Exécute le script comme Apps Script, avec MailApp et ContentService simulés. */
function load(secret: string | null = SECRET, opts: { sendThrows?: boolean; quota?: number } = {}) {
  const sendEmail = vi.fn(() => {
    if (opts.sendThrows) throw new Error('Service invoked too many times')
  })
  const context = {
    MailApp: { sendEmail, getRemainingDailyQuota: () => opts.quota ?? 100 },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ text, setMimeType: (mime: string) => ({ text, mime }) }),
    },
  }
  const code = secret === null ? SOURCE : SOURCE.replace("const SECRET = 'REMPLACE-MOI'", `const SECRET = '${secret}'`)
  vm.runInNewContext(`${code}\nthis.doPost = doPost`, context)
  const doPost = (context as unknown as { doPost: (e: unknown) => { text: string; mime: string } }).doPost
  const post = (body: unknown) => {
    const out = doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } })
    expect(out.mime).toBe('json')
    return JSON.parse(out.text)
  }
  return { post, sendEmail }
}

const mail = { secret: SECRET, name: 'Commander League', to: 'ana@gmail.com', subject: 'Sujet', text: 'Texte', html: '<p>Texte</p>' }

describe('script Google d’envoi', () => {
  it('bon mot de passe : envoie le mail et répond ok', () => {
    const { post, sendEmail } = load()
    expect(post(mail)).toEqual({ ok: true })
    expect(sendEmail).toHaveBeenCalledWith({ to: 'ana@gmail.com', subject: 'Sujet', body: 'Texte', htmlBody: '<p>Texte</p>', name: 'Commander League' })
  })

  it('mauvais mot de passe : refus, aucun mail', () => {
    const { post, sendEmail } = load()
    expect(post({ ...mail, secret: 'autre' })).toEqual({ ok: false, error: 'secret' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('mot de passe laissé à REMPLACE-MOI ou trop court : refus même si la requête le donne', () => {
    for (const s of [null, 'court']) {
      const { post, sendEmail } = load(s)
      expect(post({ ...mail, secret: s ?? 'REMPLACE-MOI' })).toEqual({ ok: false, error: 'secret' })
      expect(sendEmail).not.toHaveBeenCalled()
    }
  })

  it('requête illisible : refus', () => {
    expect(load().post('pas du json')).toEqual({ ok: false, error: 'requete' })
  })

  it('échec de Gmail : quota ou envoi', () => {
    expect(load(SECRET, { sendThrows: true, quota: 0 }).post(mail)).toEqual({ ok: false, error: 'quota' })
    expect(load(SECRET, { sendThrows: true, quota: 50 }).post(mail)).toEqual({ ok: false, error: 'envoi' })
  })

  it('le code de docs/mails.md est celui de ce fichier', () => {
    const doc = readFileSync(path.join(__dirname, '..', 'docs', 'mails.md'), 'utf8')
    const block = doc.match(/```js\n([\s\S]*?)```/)
    expect(block?.[1]).toBe(SOURCE)
  })
})
