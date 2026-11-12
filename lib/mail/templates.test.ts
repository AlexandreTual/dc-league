import { describe, it, expect } from 'vitest'
import { adminResetMail, emailChangedMail, forgotMail, invitationMail, mailLang } from './templates'

const url = 'https://dc-league.pages.dev/invitation/abc123'

describe('langue d’un mail demandée', () => {
  it('français par défaut, fr ou en acceptés, le reste refusé', () => {
    expect(mailLang(undefined)).toBe('fr')
    expect(mailLang(null)).toBe('fr')
    expect(mailLang('en')).toBe('en')
    expect(mailLang('fr')).toBe('fr')
    expect(mailLang('de')).toBeNull()
    expect(mailLang(1)).toBeNull()
  })
})

describe('modèles de mails', () => {
  it.each([
    ['invitation', invitationMail, 'Commander League — ton invitation', 'valable 7 jours'],
    ['réinitialisation admin', adminResetMail, 'Commander League — nouveau mot de passe', 'valable 7 jours'],
    ['mot de passe oublié', forgotMail, 'Commander League — nouveau mot de passe', 'valable 1 heure'],
  ])('%s : sujet, lien et durée', (_label, tpl, subject, duration) => {
    const m = tpl({ name: 'Ana', url }, 'fr')
    expect(m.subject).toBe(subject)
    expect(m.html).toContain('<html lang="fr">')
    expect(m.text).toContain(url)
    expect(m.html).toContain(`href="${url}"`)
    expect(m.text).toContain(duration)
    expect(m.html).toContain(duration)
    expect(m.text).toContain('Bonjour Ana')
    expect(m.html).toContain('Bonjour Ana')
  })

  it('adresse modifiée : prévient et renvoie vers la connexion', () => {
    const m = emailChangedMail({ name: 'Ana', url: 'https://site.test/connexion' }, 'fr')
    expect(m.subject).toBe('Commander League — adresse mail modifiée')
    expect(m.text).toContain("Bonjour Ana, l'adresse mail de ton compte vient d'être modifiée ou effacée depuis ton profil")
    expect(m.text).toContain('https://site.test/connexion')
    expect(m.html).toContain('href="https://site.test/connexion"')
    expect(m.text).toContain("Si ce n'est pas toi")
  })

  it('mot de passe oublié : texte de la spec', () => {
    const m = forgotMail({ name: 'Ana', url }, 'fr')
    expect(m.text).toContain(`Bonjour Ana, voici ton lien pour choisir un nouveau mot de passe (valable 1 heure) : ${url}`)
    expect(m.text).toContain("Si tu n'as rien demandé, ignore ce mail.")
    expect(m.html).toContain('Si tu n&#39;as rien demandé, ignore ce mail.')
  })

  it.each([invitationMail, adminResetMail, forgotMail, emailChangedMail])('nom échappé dans le HTML', (tpl) => {
    const m = tpl({ name: '<script>x</script> & "co" \'l\'', url }, 'fr')
    expect(m.html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;co&quot; &#39;l&#39;')
    expect(m.html).not.toContain('<script>')
    expect(m.text).toContain('<script>x</script>')
  })

  it('lien échappé dans le HTML', () => {
    const m = invitationMail({ name: 'Ana', url: 'https://site.test/a?b=1&c="2"' }, 'fr')
    expect(m.html).toContain('href="https://site.test/a?b=1&amp;c=&quot;2&quot;"')
  })

  it.each([
    ['invitation', invitationMail, 'Commander League — your invitation', 'valid for 7 days', 'Create my account'],
    ['réinitialisation admin', adminResetMail, 'Commander League — new password', 'valid for 7 days', 'Choose my password'],
    ['mot de passe oublié', forgotMail, 'Commander League — new password', 'valid for 1 hour', 'Choose my password'],
  ])('%s en anglais : sujet, texte, bouton, <html lang="en">', (_label, tpl, subject, duration, button) => {
    const m = tpl({ name: 'Ana', url }, 'en')
    expect(m.subject).toBe(subject)
    expect(m.html).toContain('<html lang="en">')
    expect(m.text).toContain(`Hi Ana, `)
    expect(m.text).toContain(`${duration}): ${url}`)
    expect(m.html).toContain(button)
    expect(m.html).toContain('If the button doesn’t work, copy this link: ')
    expect(m.text + m.html).not.toMatch(/Bonjour|valable|Si tu/)
  })
})
