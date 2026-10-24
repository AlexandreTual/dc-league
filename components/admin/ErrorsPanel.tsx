'use client'

import { useState } from 'react'
import { Bug } from 'lucide-react'
import type { LoggedError } from '@/lib/db-errors'
import type { AdminApi } from './useAdminApi'
import { useI18n } from '@/components/i18n/I18nProvider'
import { LOCALES } from '@/lib/i18n/lang'

/** null : journal illisible (table pas encore créée…). */
type Props = { initial: LoggedError[] | null; call: AdminApi['call']; onToast: (msg: string) => void }

/** Section « Journal des erreurs » : dernières erreurs du site et du nettoyage de nuit (docs/journaux.md). */
export default function ErrorsPanel({ initial, call, onToast }: Props) {
  const { lang, t: messages } = useI18n()
  const t = messages.admin.errors
  const date = new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Paris' })
  const [errors, setErrors] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function clear() {
    if (!confirm(t.confirmClear)) return
    setBusy(true)
    const { ok } = await call('/api/admin/errors', 'DELETE')
    setBusy(false)
    if (!ok) return
    setErrors([])
    onToast(t.cleared)
  }

  return (
    <section className="space-y-3" aria-labelledby="journal-erreurs" data-testid="errors-admin">
      <h2 id="journal-erreurs" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <Bug className="w-5 h-5 text-dc-gold" /> {t.title}{errors ? ` (${errors.length})` : ''}
      </h2>
      <p className="text-dc-muted text-sm">{t.help}</p>
      {errors === null ? (
        <p className="text-dc-red-light text-sm">{t.unavailable}</p>
      ) : errors.length === 0 ? (
        <p className="text-dc-muted text-sm">{t.empty}</p>
      ) : (
        <>
          <button
            onClick={clear}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-dc-red/40 text-dc-red-light hover:bg-dc-red/10 disabled:opacity-50 text-sm"
          >
            {t.clear}
          </button>
          <ul className="space-y-2">
            {errors.map((e) => (
              <li key={e.id} data-testid="errors-admin-row" className="bg-dc-surface border border-dc-border rounded-2xl p-3 text-sm space-y-1">
                <p className="text-dc-muted text-xs">
                  {date.format(new Date(e.at))} · {t.sources[e.source as keyof typeof t.sources] ?? e.source}
                  {e.path && <> · <span className="break-all">{e.path}</span></>}
                  {e.userId && <> · {e.userName ?? t.account(e.userId)}</>}
                </p>
                <p className="text-dc-text break-words whitespace-pre-wrap">{e.message}</p>
                {e.digest && <p className="text-dc-muted text-xs">{t.code} <code className="font-mono select-all">{e.digest}</code></p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
