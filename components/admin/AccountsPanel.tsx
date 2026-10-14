'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Link2, Mail, ShieldCheck, UserCog } from 'lucide-react'
import type { AccountStatus } from '@/lib/db-auth'
import { sendJson } from '@/components/formStyles'
import { maskEmail } from '@/lib/mail/mask'

type MailOutcome = 'sent' | 'failed' | 'disabled' | 'none'
type GeneratedLink = { playerId: string; url: string; expiresAt: string; kind: 'signup' | 'reset'; mail?: MailOutcome; email: string | null }

/** Message d'envoi ; rien si le serveur ne renvoie pas (encore) le résultat ou s'il n'y a pas d'adresse. */
function mailMessage(link: GeneratedLink): { text: string; ok: boolean } | null {
  switch (link.mail) {
    case 'sent': {
      const to = link.email ? ` à ${maskEmail(link.email)}` : ''
      return { text: link.kind === 'signup' ? `Invitation envoyée${to}` : `Lien envoyé${to}`, ok: true }
    }
    case 'failed':
      return { text: "L'envoi a échoué : copie le lien", ok: false }
    case 'disabled':
      return { text: 'Envoi de mails non configuré : copie le lien', ok: false }
    default:
      return null
  }
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export default function AccountsPanel({ players, statuses, currentUserId, isBootstrap, onToast }: {
  players: { id: string; name: string }[]
  statuses: Record<string, AccountStatus>
  currentUserId: string | null
  isBootstrap: boolean
  onToast: (msg: string) => void
}) {
  const router = useRouter()
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
    })
    setBusy(null)
    if (error) return onToast(`Erreur : ${error}`)
    const { url, expiresAt, mail } = data as { url: string; expiresAt: string; mail?: MailOutcome }
    setLink({ playerId, url, expiresAt, kind, mail, email })
    setCopied(false)
    router.refresh()
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    setBusy(userId)
    const { error } = await sendJson(`/api/admin/users/${userId}`, 'PATCH', { is_admin: isAdmin })
    setBusy(null)
    if (error) return onToast(`Erreur : ${error}`)
    onToast(isAdmin ? 'Rôle admin donné' : 'Rôle admin retiré')
    router.refresh()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      onToast('Copie impossible : sélectionne le lien et copie-le à la main')
    }
  }

  const buttonClass =
    'flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border/60 rounded-lg text-dc-muted hover:text-dc-gold hover:border-dc-gold/40 transition-all disabled:opacity-40'

  return (
    <div className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-4">
      <h2 className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <UserCog className="w-5 h-5 text-dc-gold" />
        Comptes joueurs
      </h2>

      {isBootstrap && (
        <p className="text-sm text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-lg px-3 py-2">
          Première configuration : coche « admin » sur ton joueur, clique « Inviter », puis ouvre le lien pour créer ton compte.
          Le mot de passe admin partagé sera ensuite désactivé.
        </p>
      )}

      <ul className="divide-y divide-dc-border/60">
        {players.map((player) => {
          const status = statuses[player.id] ?? { status: 'none' as const }
          const showLink = link?.playerId === player.id
          const mailStatus = showLink && link ? mailMessage(link) : null
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
                  <span className="text-xs text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-full px-2 py-0.5">Invitation en attente</span>
                ) : (
                  <span className="text-xs text-dc-muted border border-dc-border rounded-full px-2 py-0.5">Pas de compte</span>
                )}

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {status.status === 'account' ? (
                    <>
                      <button className={buttonClass} disabled={busy !== null} onClick={() => generate(player.id, 'reset', status.email ?? null)}>
                        <KeyRound className="w-3.5 h-3.5" /> Lien de réinitialisation
                      </button>
                      <button
                        className={buttonClass}
                        disabled={busy !== null}
                        onClick={() => toggleAdmin(status.userId, !status.isAdmin)}
                        title={status.userId === currentUserId ? 'Ton propre compte' : undefined}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> {status.isAdmin ? 'Retirer admin' : 'Rendre admin'}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="email"
                        inputMode="email"
                        aria-label={`Adresse mail de ${player.name} (facultatif)`}
                        placeholder="Adresse mail (facultatif)"
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
                        admin
                      </label>
                      <button className={buttonClass} disabled={busy !== null} onClick={() => generate(player.id, 'signup')}>
                        <Link2 className="w-3.5 h-3.5" /> {status.status === 'pending' ? 'Nouvelle invitation' : 'Inviter'}
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
                    {link.kind === 'signup' ? 'Lien de création de compte' : 'Lien de réinitialisation'} à envoyer à {player.name},
                    valable jusqu&apos;au {dateFormat.format(new Date(link.expiresAt))} :
                  </p>
                  <div className="flex items-center gap-2">
                    <input readOnly aria-label="Lien à envoyer" value={link.url} className="flex-1 bg-dc-surface border border-dc-border rounded-lg px-3 py-1.5 text-xs text-dc-text" onFocus={(e) => e.target.select()} />
                    <button className={buttonClass} onClick={() => copy(link.url)}>
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copié' : 'Copier'}
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
