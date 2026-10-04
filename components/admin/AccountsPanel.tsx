'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Link2, ShieldCheck, UserCog } from 'lucide-react'
import type { AccountStatus } from '@/lib/db-auth'
import { sendJson } from '@/components/formStyles'

type GeneratedLink = { playerId: string; url: string; expiresAt: string; kind: 'signup' | 'reset' }

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
  const [link, setLink] = useState<GeneratedLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function generate(playerId: string, kind: 'signup' | 'reset') {
    setBusy(playerId)
    const { error, data } = await sendJson('/api/admin/invitations', 'POST', {
      player_id: playerId,
      kind,
      grant_admin: kind === 'signup' && (grantAdmin[playerId] ?? false),
    })
    setBusy(null)
    if (error) return onToast(`Erreur : ${error}`)
    const { url, expiresAt } = data as { url: string; expiresAt: string }
    setLink({ playerId, url, expiresAt, kind })
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
    await navigator.clipboard.writeText(url)
    setCopied(true)
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
          return (
            <li key={player.id} className="py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-dc-text font-semibold min-w-[8rem]">{player.name}</span>
                {status.status === 'account' ? (
                  <span className="text-xs text-dc-green-light bg-dc-green/20 border border-dc-green/30 rounded-full px-2 py-0.5">
                    @{status.username}{status.isAdmin && ' · admin'}
                  </span>
                ) : status.status === 'pending' ? (
                  <span className="text-xs text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-full px-2 py-0.5">Invitation en attente</span>
                ) : (
                  <span className="text-xs text-dc-muted border border-dc-border rounded-full px-2 py-0.5">Pas de compte</span>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {status.status === 'account' ? (
                    <>
                      <button className={buttonClass} disabled={busy !== null} onClick={() => generate(player.id, 'reset')}>
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
                  <p className="text-xs text-dc-muted">
                    {link.kind === 'signup' ? 'Lien de création de compte' : 'Lien de réinitialisation'} à envoyer à {player.name},
                    valable jusqu&apos;au {dateFormat.format(new Date(link.expiresAt))} :
                  </p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={link.url} className="flex-1 bg-dc-surface border border-dc-border rounded-lg px-3 py-1.5 text-xs text-dc-text" onFocus={(e) => e.target.select()} />
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
