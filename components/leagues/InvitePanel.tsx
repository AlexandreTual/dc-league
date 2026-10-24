'use client'

import { useEffect, useState } from 'react'
import { Copy, Link2, RefreshCcw } from 'lucide-react'
import { inviteUrl } from '@/lib/leagues/join'
import { leagueShareText } from '@/lib/share'
import type { AdminApi } from '@/components/admin/useAdminApi'
import { useT } from '@/components/i18n/I18nProvider'
import ShareButton from '@/components/ShareButton'

/** Lien d'invitation de la ligue : créer, copier, renouveler (l'ancien cesse de marcher). */
export default function InvitePanel({ leagueId, leagueName, initialToken, api }: { leagueId: string; leagueName?: string; initialToken: string | null; api: AdminApi }) {
  const { call, showToast } = api
  const messages = useT()
  const t = messages.leagues.invite
  const [token, setToken] = useState(initialToken)
  const [origin, setOrigin] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmRenew, setConfirmRenew] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])

  const url = token && origin ? inviteUrl(origin, token) : ''

  async function renew() {
    setConfirmRenew(false)
    setLoading(true)
    try {
      const { ok, data } = await call<{ token: string }>(`/api/leagues/${leagueId}/invite`, 'POST')
      if (!ok || !data) return
      setToken(data.token)
      showToast(token ? t.renewed : t.created)
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      showToast(t.copied)
    } catch {
      showToast(t.copyFailed)
    }
  }

  return (
    <section className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-3" aria-labelledby="invitation">
      <h2 id="invitation" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <Link2 className="w-5 h-5 text-dc-gold" /> {t.title}
      </h2>
      <p className="text-dc-muted text-sm">{t.text}</p>
      {token ? (
        <>
          <input
            readOnly
            value={url}
            aria-label={t.linkAria}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-dc-bg border border-dc-border rounded-xl px-3 py-2 text-dc-text text-xs font-mono"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copy} disabled={!url} className="inline-flex items-center gap-1.5 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
              <Copy className="w-4 h-4" /> {t.copy}
            </button>
            <ShareButton
              disabled={!url}
              getData={() => ({ title: messages.common.siteName, text: leagueShareText(leagueName, messages), url })}
              className="inline-flex items-center bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            />
            {confirmRenew ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-dc-red-light">{t.oldWillStop}</span>
                <button onClick={renew} className="px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg">{t.renew}</button>
                <button onClick={() => setConfirmRenew(false)} className="px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg">{t.cancel}</button>
              </span>
            ) : (
              <button onClick={() => setConfirmRenew(true)} disabled={loading} className="inline-flex items-center gap-1.5 text-dc-muted hover:text-dc-text border border-dc-border/50 px-3 py-2 rounded-lg text-sm disabled:opacity-40">
                <RefreshCcw className="w-4 h-4" /> {t.renewLink}
              </button>
            )}
          </div>
        </>
      ) : (
        <button onClick={renew} disabled={loading} className="inline-flex items-center gap-1.5 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
          <Link2 className="w-4 h-4" /> {loading ? t.creating : t.create}
        </button>
      )}
    </section>
  )
}
