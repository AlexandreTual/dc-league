import { describe, it, expect } from 'vitest'
import { adminResetMail, forgotMail, invitationMail } from './templates'

const url = 'https://dc-league.pages.dev/invitation/abc123'

describe('modèles de mails', () => {
  it.each([
    ['invitation', invitationMail, 'Commander League — ton invitation', 'valable 7 jours'],
    ['réinitialisation admin', adminResetMail, 'Commander League — nouveau mot de passe', 'valable 7 jours'],
    ['mot de passe oublié', forgotMail, 'Commander League — nouveau mot de passe', 'valable 1 heure'],
  ])('%s : sujet, lien et durée', (_label, tpl, subject, duration) => {
    const m = tpl({ name: 'Ana', url })
    expect(m.subject).toBe(subject)
    expect(m.text).toContain(url)
    expect(m.html).toContain(`href="${url}"`)
    expect(m.text).toContain(duration)
    expect(m.html).toContain(duration)
    expect(m.text).toContain('Bonjour Ana')
    expect(m.html).toContain('Bonjour Ana')
  })

  it('mot de passe oublié : texte de la spec', () => {
    const m = forgotMail({ name: 'Ana', url })
    expect(m.text).toContain(`Bonjour Ana, voici ton lien pour choisir un nouveau mot de passe (valable 1 heure) : ${url}`)
    expect(m.text).toContain("Si tu n'as rien demandé, ignore ce mail.")
    expect(m.html).toContain('Si tu n&#39;as rien demandé, ignore ce mail.')
  })

  it.each([invitationMail, adminResetMail, forgotMail])('nom échappé dans le HTML', (tpl) => {
    const m = tpl({ name: '<script>x</script> & "co" \'l\'', url })
    expect(m.html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;co&quot; &#39;l&#39;')
    expect(m.html).not.toContain('<script>')
    expect(m.text).toContain('<script>x</script>')
  })

  it('lien échappé dans le HTML', () => {
    const m = invitationMail({ name: 'Ana', url: 'https://site.test/a?b=1&c="2"' })
    expect(m.html).toContain('href="https://site.test/a?b=1&amp;c=&quot;2&quot;"')
  })
})
