import type { Mail } from './index'
import { isLang, type Lang } from '@/lib/i18n/lang'
import { messages, type Messages } from '@/lib/i18n/messages'

export type MailContent = Omit<Mail, 'to'>
export type MailInput = { name: string; url: string }

type Paragraphs = Messages['mail']['invitation']

/** Langue d'un mail demandée par le client : absente → français, inconnue → null (requête invalide). */
export function mailLang(value: unknown): Lang | null {
  if (value === undefined || value === null) return 'fr'
  return isLang(value) ? value : null
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Mail simple : fond sombre, bouton doré, texte brut équivalent, dans la langue demandée. */
function build(lang: Lang, pick: (t: Messages['mail']) => Paragraphs, { name, url }: MailInput): MailContent {
  const t = messages(lang).mail
  const p = pick(t)
  const text = [`${t.hello(name)}, ${p.intro}${t.linkSeparator}${url}`, p.outro].join('\n\n')
  const html = `<!doctype html>
<html lang="${lang}"><body style="margin:0;padding:24px;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
<div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#fbbf24">Commander League</p>
<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(t.hello(name))}, ${escapeHtml(p.intro)}.</p>
<p style="margin:0 0 16px;text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;background:#fbbf24;color:#0f172a;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(p.button)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#94a3b8;word-break:break-all">${escapeHtml(t.buttonFallback)}${escapeHtml(url)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8">${escapeHtml(p.outro)}</p>
</div></body></html>`
  return { subject: p.subject, text, html }
}

export function invitationMail(input: MailInput, lang: Lang): MailContent {
  return build(lang, (t) => t.invitation, input)
}

export function adminResetMail(input: MailInput, lang: Lang): MailContent {
  return build(lang, (t) => t.adminReset, input)
}

export function forgotMail(input: MailInput, lang: Lang): MailContent {
  return build(lang, (t) => t.forgot, input)
}
