'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { gathererUrl, oracleFaces } from '@/lib/cards/oracle'
import type { CardRow, Ruling } from '@/lib/cards/types'

const UNAVAILABLE = 'Règles indisponibles pour le moment'

type RulingsState = { status: 'loading' } | { status: 'ok'; rulings: Ruling[] } | { status: 'error'; message: string }

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Texte Oracle (fait foi), texte imprimé français, règles et lien Gatherer d'une carte. */
export default function OracleModal({ en, fr, onClose }: { en: CardRow; fr: CardRow | null; onClose: () => void }) {
  const [rulings, setRulings] = useState<RulingsState>({ status: 'loading' })
  const faces = oracleFaces(en, fr)
  const title = fr?.printed_name ?? en.name

  useEffect(() => {
    let live = true
    setRulings({ status: 'loading' })
    fetch(`/api/cards/${encodeURIComponent(en.oracle_id)}/rulings`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { rulings?: Ruling[]; error?: string }
        if (!live) return
        if (res.ok && Array.isArray(body.rulings)) setRulings({ status: 'ok', rulings: body.rulings })
        else setRulings({ status: 'error', message: body.error ?? UNAVAILABLE })
      })
      .catch(() => live && setRulings({ status: 'error', message: UNAVAILABLE }))
    return () => { live = false }
  }, [en.oracle_id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Portail : au-dessus de tout, y compris le bandeau du site (contexte d'empilement de la page).
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        role="dialog"
        aria-label="Oracle et règles"
        className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-xl max-h-full flex flex-col text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold text-lg leading-tight">{title}</h2>
          {title !== en.name && <p className="text-dc-muted text-xs">{en.name}</p>}
        </div>

        <div className="px-4 py-3 space-y-4 overflow-y-auto overscroll-contain" data-testid="oracle-body">
          {faces.map((face, i) => (
            <section key={i} className="space-y-2">
              {faces.length > 1 && (
                <h3 className="text-dc-gold font-semibold">{face.printedName ? `${face.printedName} (${face.name})` : face.name}</h3>
              )}
              <p className="text-dc-muted text-xs">{face.typeLine}</p>
              <div>
                <h4 className="text-xs uppercase tracking-wide text-dc-muted">Texte Oracle (anglais, fait foi)</h4>
                <p className="text-dc-text whitespace-pre-line" data-testid="oracle-text">{face.oracle ?? '—'}</p>
              </div>
              {face.printed && (
                <div>
                  <h4 className="text-xs uppercase tracking-wide text-dc-muted">Texte imprimé en français</h4>
                  <p className="text-dc-text whitespace-pre-line">{face.printed}</p>
                </div>
              )}
            </section>
          ))}
          {faces.some((f) => f.printed) && (
            <p className="text-dc-muted text-xs">Le texte imprimé peut être dépassé par un errata : c’est le texte Oracle qui fait foi.</p>
          )}

          <section className="space-y-2">
            <h3 className="text-dc-gold font-semibold">Règles</h3>
            {rulings.status === 'loading' && <p className="text-dc-muted">Chargement…</p>}
            {rulings.status === 'error' && <p className="text-dc-red-light" data-testid="rulings-error">{rulings.message}</p>}
            {rulings.status === 'ok' && rulings.rulings.length === 0 && <p className="text-dc-muted">Aucune règle publiée pour cette carte.</p>}
            {rulings.status === 'ok' && rulings.rulings.length > 0 && (
              <ul className="space-y-2" data-testid="rulings">
                {rulings.rulings.map((r, i) => (
                  <li key={i}>
                    <p className="text-dc-muted text-xs">{formatDate(r.date)}{r.source === 'scryfall' ? ' · note Scryfall' : ''}</p>
                    <p className="text-dc-text">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {rulings.status === 'ok' && rulings.rulings.length > 0 && <p className="text-dc-muted text-xs">Les règles ne sont publiées qu’en anglais.</p>}
          </section>
        </div>

        <div className="px-4 py-3 border-t border-dc-border flex items-center gap-3">
          <a
            href={gathererUrl(en, fr)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Voir la fiche officielle sur Gatherer (nouvel onglet)"
            className="inline-flex items-center gap-1 text-dc-gold hover:underline"
          >
            Fiche Gatherer <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={onClose} className="ml-auto px-3 py-1.5 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/40">Fermer</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
