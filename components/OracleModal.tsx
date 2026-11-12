'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Sparkles } from 'lucide-react'
import { gathererUrl, oracleFaces } from '@/lib/cards/oracle'
import type { CardRow, Ruling } from '@/lib/cards/types'
import { formatDate as formatLangDate, type Lang } from '@/lib/i18n/lang'
import { useI18n } from '@/components/i18n/I18nProvider'

type RulingsState = { status: 'loading' } | { status: 'ok'; rulings: Ruling[] } | { status: 'error'; message: string }

function formatDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : formatLangDate(d, lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Texte Oracle (fait foi), texte imprimé français, règles et lien Gatherer d'une carte ; « Demander à l'IA »
 * quand l'assistant est disponible (onAskAi fourni).
 */
export default function OracleModal({ en, fr, onClose, onAskAi }: { en: CardRow; fr: CardRow | null; onClose: () => void; onAskAi?: () => void }) {
  const { lang, t } = useI18n()
  const m = t.decks.oracle
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
        else setRulings({ status: 'error', message: body.error ?? m.unavailable })
      })
      .catch(() => live && setRulings({ status: 'error', message: m.unavailable }))
    return () => { live = false }
  }, [en.oracle_id, m.unavailable])

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
        aria-label={m.title}
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
                <h4 className="text-xs uppercase tracking-wide text-dc-muted">{m.oracleText}</h4>
                <p className="text-dc-text whitespace-pre-line" data-testid="oracle-text">{face.oracle ?? '—'}</p>
              </div>
              {face.printed && (
                <div>
                  <h4 className="text-xs uppercase tracking-wide text-dc-muted">{m.printedText}</h4>
                  <p className="text-dc-text whitespace-pre-line">{face.printed}</p>
                </div>
              )}
            </section>
          ))}
          {faces.some((f) => f.printed) && (
            <p className="text-dc-muted text-xs">{m.errataNote}</p>
          )}

          <section className="space-y-2">
            <h3 className="text-dc-gold font-semibold">{m.rulings}</h3>
            {rulings.status === 'loading' && <p className="text-dc-muted">{m.loading}</p>}
            {rulings.status === 'error' && <p className="text-dc-red-light" data-testid="rulings-error">{rulings.message}</p>}
            {rulings.status === 'ok' && rulings.rulings.length === 0 && <p className="text-dc-muted">{m.noRulings}</p>}
            {rulings.status === 'ok' && rulings.rulings.length > 0 && (
              <ul className="space-y-2" data-testid="rulings">
                {rulings.rulings.map((r, i) => (
                  <li key={i}>
                    <p className="text-dc-muted text-xs">{formatDate(r.date, lang)}{r.source === 'scryfall' ? m.scryfallNote : ''}</p>
                    <p className="text-dc-text">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {rulings.status === 'ok' && rulings.rulings.length > 0 && <p className="text-dc-muted text-xs">{m.englishOnly}</p>}
          </section>
        </div>

        <div className="px-4 py-3 border-t border-dc-border flex items-center gap-3">
          <a
            href={gathererUrl(en, fr)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={m.gathererLabel}
            className="inline-flex items-center gap-1 text-dc-gold hover:underline"
          >
            {m.gatherer} <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {onAskAi && (
            <button onClick={onAskAi} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dc-gold/40 text-dc-gold hover:bg-dc-gold/10">
              <Sparkles className="w-3.5 h-3.5" /> {m.askAi}
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-3 py-1.5 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/40">{m.close}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
