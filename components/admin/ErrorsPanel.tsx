'use client'

import { useState } from 'react'
import { Bug } from 'lucide-react'
import type { LoggedError } from '@/lib/db-errors'
import type { AdminApi } from './useAdminApi'

const SOURCE: Record<string, string> = { navigateur: 'Navigateur', serveur: 'Serveur', nettoyage: 'Nettoyage de nuit' }

const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Paris' })

/** null : journal illisible (table pas encore créée…). */
type Props = { initial: LoggedError[] | null; call: AdminApi['call']; onToast: (msg: string) => void }

/** Section « Journal des erreurs » : dernières erreurs du site et du nettoyage de nuit (docs/journaux.md). */
export default function ErrorsPanel({ initial, call, onToast }: Props) {
  const [errors, setErrors] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function clear() {
    if (!confirm('Vider le journal des erreurs ?')) return
    setBusy(true)
    const { ok } = await call('/api/admin/errors', 'DELETE')
    setBusy(false)
    if (!ok) return
    setErrors([])
    onToast('Journal vidé')
  }

  return (
    <section className="space-y-3" aria-labelledby="journal-erreurs" data-testid="errors-admin">
      <h2 id="journal-erreurs" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <Bug className="w-5 h-5 text-dc-gold" /> Journal des erreurs{errors ? ` (${errors.length})` : ''}
      </h2>
      <p className="text-dc-muted text-sm">
        Pages qui ont planté chez un joueur (avec le code qu&apos;il a pu te transmettre), erreurs des routes du site et
        échecs du nettoyage de nuit. Les 50 plus récentes ; le journal garde les 200 dernières.
      </p>
      {errors === null ? (
        <p className="text-dc-red-light text-sm">Journal indisponible pour le moment.</p>
      ) : errors.length === 0 ? (
        <p className="text-dc-muted text-sm">Aucune erreur enregistrée.</p>
      ) : (
        <>
          <button
            onClick={clear}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-dc-red/40 text-dc-red-light hover:bg-dc-red/10 disabled:opacity-50 text-sm"
          >
            Vider le journal
          </button>
          <ul className="space-y-2">
            {errors.map((e) => (
              <li key={e.id} data-testid="errors-admin-row" className="bg-dc-surface border border-dc-border rounded-2xl p-3 text-sm space-y-1">
                <p className="text-dc-muted text-xs">
                  {date.format(new Date(e.at))} · {SOURCE[e.source] ?? e.source}
                  {e.path && <> · <span className="break-all">{e.path}</span></>}
                  {e.userId && <> · {e.userName ?? `compte ${e.userId}`}</>}
                </p>
                <p className="text-dc-text break-words whitespace-pre-wrap">{e.message}</p>
                {e.digest && <p className="text-dc-muted text-xs">Code : <code className="font-mono select-all">{e.digest}</code></p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
