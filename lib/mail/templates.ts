import type { Mail } from './index'

type MailContent = Omit<Mail, 'to'>
type MailInput = { name: string; url: string }

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Mail simple : fond sombre, bouton doré, texte brut équivalent. */
function build(subject: string, paragraphs: { intro: string; button: string; outro: string }, { name, url }: MailInput): MailContent {
  const text = [`Bonjour ${name}, ${paragraphs.intro} : ${url}`, paragraphs.outro].join('\n\n')
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#fbbf24">Commander League</p>
<p style="margin:0 0 16px;line-height:1.5">Bonjour ${escapeHtml(name)}, ${escapeHtml(paragraphs.intro)}.</p>
<p style="margin:0 0 16px;text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;background:#fbbf24;color:#0f172a;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(paragraphs.button)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#94a3b8;word-break:break-all">Si le bouton ne marche pas, copie ce lien : ${escapeHtml(url)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8">${escapeHtml(paragraphs.outro)}</p>
</div></body></html>`
  return { subject, text, html }
}

export function invitationMail(input: MailInput): MailContent {
  return build('Commander League — ton invitation', {
    intro: 'tu es invité à rejoindre la Commander League. Voici ton lien pour créer ton compte (valable 7 jours)',
    button: 'Créer mon compte',
    outro: "Si tu ne t'attendais pas à cette invitation, ignore ce mail.",
  }, input)
}

export function adminResetMail(input: MailInput): MailContent {
  return build('Commander League — nouveau mot de passe', {
    intro: "l'admin t'a envoyé un lien pour choisir un nouveau mot de passe (valable 7 jours)",
    button: 'Choisir mon mot de passe',
    outro: "Si tu n'as rien demandé, ignore ce mail.",
  }, input)
}

export function forgotMail(input: MailInput): MailContent {
  return build('Commander League — nouveau mot de passe', {
    intro: 'voici ton lien pour choisir un nouveau mot de passe (valable 1 heure)',
    button: 'Choisir mon mot de passe',
    outro: "Si tu n'as rien demandé, ignore ce mail.",
  }, input)
}
