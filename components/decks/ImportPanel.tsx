'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Upload } from 'lucide-react'
import { parseDeckList } from '@/lib/cards/parse'
import type { ImportSummary } from '@/lib/cards/types'
import { errorClass, inputClass, primaryButtonClass } from '@/components/formStyles'
import { useT } from '@/components/i18n/I18nProvider'
import { importDeckText, progressLabel, type ImportProgress } from './importDeck'

/** Résumé d'un import terminé : nombre de cartes, part en français, cartes introuvables. */
export function ImportResult({ deckId, summary }: { deckId: string; summary: ImportSummary }) {
  const m = useT().decks.import
  const percent = summary.total ? Math.round((summary.frenchCount / summary.total) * 100) : 0
  return (
    <div className="space-y-2" data-testid="import-done">
      <p className="text-dc-text text-sm">
        <strong>{m.resultCards(summary.total)}</strong>{m.resultRest(percent)}
        {summary.commanders === 0 && m.noCommander}
      </p>
      {summary.notFound.length > 0 && (
        <div className={errorClass + ' text-left'}>
          <p className="font-semibold mb-1">{m.notFoundTitle(summary.notFound.length)}</p>
          <ul className="text-xs space-y-0.5">
            {summary.notFound.map((n) => (
              <li key={n.lineNumber}>{m.line(n.lineNumber, n.text)}</li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`/decks/${deckId}`} className="inline-block text-dc-gold text-sm hover:underline">{m.seeDeck}</Link>
    </div>
  )
}

/** Barre et texte de progression d'un import. */
export function ImportProgressBar({ progress }: { progress: ImportProgress }) {
  const t = useT()
  const ratio = progress.step === 'link' ? 0.05 : progress.step === 'committing' ? 1 : Math.max(0.05, progress.done / progress.total)
  return (
    <div className="space-y-1" data-testid="import-progress">
      <div className="h-2 bg-dc-bg border border-dc-border rounded-full overflow-hidden">
        <div className="h-full bg-dc-gold/60 transition-all" style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="text-dc-muted text-xs">{progressLabel(progress, t)}</p>
    </div>
  )
}

/** Import par liste collée : solution de repli quand le deck n'a pas de lien ou que le site refuse la lecture. */
export default function ImportPanel({ deckId, initialText = '', onDone }: { deckId: string; initialText?: string; onDone: (summary: ImportSummary) => void }) {
  const t = useT()
  const m = t.decks.import
  const [text, setText] = useState(initialText)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [failure, setFailure] = useState<{ error: string; resumeFrom?: number } | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const parsed = useMemo(() => parseDeckList(text), [text])

  const cardCount = parsed.lines.reduce((n, l) => n + l.quantity, 0)
  const commanderCount = parsed.lines.filter((l) => l.section === 'commander').length

  async function run(from: number) {
    setFailure(null)
    const outcome = await importDeckText(deckId, text, from, { t, onProgress: setProgress })
    setProgress(null)
    if (!outcome.ok) return setFailure({ error: outcome.error, resumeFrom: outcome.resumeFrom })
    setSummary(outcome.summary)
    onDone(outcome.summary)
  }

  if (summary) return <ImportResult deckId={deckId} summary={summary} />

  const busy = progress !== null

  return (
    <div className="space-y-3">
      <textarea
        className={inputClass + ' font-mono text-xs'}
        rows={12}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        aria-label={m.listLabel}
        placeholder={'Commander\n1 Kenrith, the Returned King (ELD) 303\n\nDeck\n1 Sol Ring (C21) 263\n…'}
      />
      <p className="text-dc-muted text-xs">
        {m.parsed(cardCount, commanderCount, parsed.ignored, parsed.errors.length)}
      </p>
      {parsed.errors.length > 0 && (
        <ul className="text-xs text-dc-red-light space-y-0.5">
          {parsed.errors.map((e) => (
            <li key={e.lineNumber}>{m.unreadableLine(e.lineNumber, e.text)}</li>
          ))}
        </ul>
      )}
      {parsed.tooLong && <p className={errorClass}>{m.tooLong}</p>}
      {progress && <ImportProgressBar progress={progress} />}
      {failure && <p className={errorClass}>{failure.error}</p>}

      {failure?.resumeFrom !== undefined ? (
        <button className={primaryButtonClass} onClick={() => run(failure.resumeFrom!)}>{m.resume}</button>
      ) : (
        <button className={primaryButtonClass} disabled={busy || cardCount === 0 || parsed.tooLong} onClick={() => run(0)}>
          <span className="inline-flex items-center gap-2"><Upload className="w-4 h-4" /> {busy ? m.importing : m.import}</span>
        </button>
      )}
    </div>
  )
}
