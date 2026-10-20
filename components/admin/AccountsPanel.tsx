'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Link2, Mail, ShieldCheck, UserCog } from 'lucide-react'
import type { AccountStatus } from '@/lib/db-auth'
import { sendJson } from '@/components/formStyles'
import { maskEmail } from '@/lib/mail/mask'
import { useI18n } from '@/components/i18n/I18nProvider'
import { LOCALES, type Lang } from '@/lib/i18n/lang'
import type { Messages } from '@/lib/i18n/messages'

type MailOutcome = 'sent' | 'failed' | 'disabled' | 'none'
type GeneratedLink = { playerId: string; url: string; expiresAt: string; kind: 'signup' | 'reset'; mail?: MailOutcome; email: string | null }

/** Message d'envoi ; rien si le serveur ne renvoie pas (encore) le résultat ou s'il n'y a pas d'adresse. */
function mailMessage(link: GeneratedLink, t: Messages['admin']['accounts']): { text: string; ok: boolean } | null {
  switch (link.mail) {
    case 'sent': {
      const to = link.email ? t.sentTo(maskEmail(link.email)) : ''
      return { text: link.kind === 'signup' ? t.invitationSent(to) : t.linkSent(to), ok: true }
    }
    case 'failed':
      return { text: t.mailFailed, ok: false }
    case 'disabled':
      return { text: t.mailDisabled, ok: false }
    default:
      return null
  }
}

export default function AccountsPanel({ players, statuses, currentUserId, isBootstrap, onToast }: {
  players: { id: string; name: string }[]
  statuses: Record<string, AccountStatus>
  currentUserId: string | null
  isBootstrap: boolean
  onToast: (msg: string) => void
}) {
  const router = useRouter()
  const { lang, t: messages } = useI18n()
  const t = messages.admin.accounts
  const dateFormat = new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' })
  const [mailLangs, setMailLangs] = useState<Record<string, Lang>>({})
  const [grantAdmin, setGrantAdmin] = useState<Record<string, boolean>>({})
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [link, setLink] = useState<GeneratedLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function generate(playerId: string, kind: 'signup' | 'reset', accountEmail: string | null = null) {
    setBusy(playerId)
    const email = kind === 'signup' ? (emails[playerId] ?? '').trim() || null : accountEmail
    const { error, data } = await sendJson('/api/admin/invitations', 'POST', {
      player_id: playerId,
      kind,
      grant_admin: kind === 'signup' && (grantAdmin[playerId] ?? false),
      ...(kind === 'signup' && email ? { email } : {}),
      // Langue du mail : choisie pour une invitation, sinon (et par défaut) celle de l'interface de l'admin.
      lang: kind === 'signup' ? (mailLangs[playerId] ?? lang) : lang,
    })
    setBusy(null)
    if (error) return onToast(messages.admin.error(error))
    const { url, expiresAt, mail } = data as { url: string; expiresAt: string; mail?: MailOutcome }
    setLink({ playerId, url, expiresAt, kind, mail, email })
    setCopied(false)
    router.refresh()
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    setBusy(userId)
    const { error } = await sendJson(`/api/admin/users/${userId}`, 'PATCH', { is_admin: isAdmin })
    setBusy(null)
    if (error) return onToast(messages.admin.error(error))
    onToast(isAdmin ? t.adminGranted : t.adminRemoved)
    router.refresh()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      onToast(t.copyFailed)
    }
  }

  const buttonClass =
    'flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border/60 rounded-lg text-dc-muted hover:text-dc-gold hover:border-dc-gold/40 transition-all disabled:opacity-40'

  return (
    <div className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-4">
      <h2 className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <UserCog className="w-5 h-5 text-dc-gold" />
        {t.title}
      </h2>

      {isBootstrap && (
        <p className="text-sm text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-lg px-3 py-2">
          {t.bootstrap}
        </p>
      )}

      <ul className="divide-y divide-dc-border/60">
        {players.map((player) => {
          const status = statuses[player.id] ?? { status: 'none' as const }
          const showLink = link?.playerId === player.id
          const mailStatus = showLink && link ? mailMessage(link, t) : null
          return (
            <li key={player.id} className="py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[8rem]">
                  <span className="text-dc-text font-semibold">{player.name}</span>
                  {status.status !== 'none' && status.email && (
                    <p className="text-xs text-dc-muted break-all" data-testid="account-email">{status.email}</p>
                  )}
                </div>
                {status.status === 'account' ? (
                  <span className="text-xs text-dc-green-light bg-dc-green/20 border border-dc-green/30 rounded-full px-2 py-0.5">
                    @{status.username}{status.isAdmin && ' · admin'}
                  </span>
                ) : status.status === 'pending' ? (
                  <span className="text-xs text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-full px-2 py-0.5">{t.pending}</span>
                ) : (
                  <span className="text-xs text-dc-muted border border-dc-border rounded-full px-2 py-0.5">{t.noAccount}</span>
                )}

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {status.status === 'account' ? (
                    <>
                      <button className={buttonClass} disabled={busy !== null} onClick={() => generate(player.id, 'reset', status.email ?? null)}>
                        <KeyRound className="w-3.5 h-3.5" /> {t.resetLink}
                      </button>
                      <button
                        className={buttonClass}
                        disabled={busy !== null}
                        onClick={() => toggleAdmin(status.userId, !status.isAdmin)}
                        title={status.userId === currentUserId ? t.ownAccount : undefined}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> {status.isAdmin ? t.removeAdmin : t.makeAdmin}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="email"
                        inputMode="email"
                        aria-label={t.emailLabel(player.name)}
                        placeholder={t.emailPlaceholder}
                        value={emails[player.id] ?? ''}
                        onChange={(e) => setEmails({ ...emails, [player.id]: e.target.value })}
                        className="w-full sm:w-56 bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-xs text-dc-text placeholder-dc-muted/60 focus:outline-none focus:border-dc-gold/50"
                      />
                      <label className="flex items-center gap-1 text-xs text-dc-muted">
                        <input
                          type="checkbox"
                          checked={grantAdmin[player.id] ?? false}
                          onChange={(e) => setGrantAdmin({ ...grantAdmin, [player.id]: e.target.checked })}
                        />
                        {t.adminCheckbox}
                      </label>
                      <label className="flex items-center gap-1 text-xs text-dc-muted">
                        <span>{t.mailLang}</span>
                        <select
                          data-testid="invite-mail-lang"
                          aria-label={t.mailLangLabel(player.name)}
                          value={mailLangs[player.id] ?? lang}
                          onChange={(e) => setMailLangs({ ...mailLangs, [player.id]: e.target.value as Lang })}
                          className="bg-dc-bg border border-dc-border rounded-lg px-2 py-1 text-xs text-dc-text focus:outline-none focus:border-dc-gold/50"
                        >
                          <option value="fr">{messages.language.names.fr}</option>
                          <option value="en">{messages.language.names.en}</option>
                        </select>
                      </label>
                      <button className={buttonClass} disabled={busy !== null} onClick={() => generate(player.id, 'signup')}>
                        <Link2 className="w-3.5 h-3.5" /> {status.status === 'pending' ? t.newInvitation : t.invite}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showLink && link && (
                <div className="bg-dc-bg border border-dc-gold/30 rounded-xl p-3 space-y-2">
                  {mailStatus && (
                    <p
                      data-testid="invite-mail-status"
                      className={`flex items-center gap-1.5 text-xs ${mailStatus.ok ? 'text-dc-green-light' : 'text-dc-red-light'}`}
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" /> {mailStatus.text}
                    </p>
                  )}
                  <p className="text-xs text-dc-muted">
                    {t.linkFor(link.kind === 'signup' ? t.signupLink : t.resetLink, player.name, dateFormat.format(new Date(link.expiresAt)))}
                  </p>
                  <div className="flex items-center gap-2">
                    <input readOnly aria-label={t.linkLabel} value={link.url} className="flex-1 bg-dc-surface border border-dc-border rounded-lg px-3 py-1.5 text-xs text-dc-text" onFocus={(e) => e.target.select()} />
                    <button className={buttonClass} onClick={() => copy(link.url)}>
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t.copied : t.copy}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
