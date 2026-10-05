'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Link2, Upload } from 'lucide-react'
import { MAX_BATCH_LINES, parseDeckList } from '@/lib/cards/parse'
import type { ImportSummary } from '@/lib/cards/types'
import { errorClass, inputClass, primaryButtonClass, sendJson } from '@/components/formStyles'

type Phase =
  | { step: 'edit' }
  | { step: 'resolving'; done: number; total: number }
  | { step: 'failed'; done: number; total: number; error: string }
  | { step: 'committing' }
  | { step: 'done'; summary: ImportSummary }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** `defaultLink` : lien du deck déjà enregistré (Moxfield), proposé pour la récupération. */
export default function ImportPanel({ deckId, defaultLink = '', onDone }: { deckId: string; defaultLink?: string; onDone: (total: number) => void }) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ step: 'edit' })
  const [commitError, setCommitError] = useState('')
  const [link, setLink] = useState(defaultLink)
  const [linkState, setLinkState] = useState<{ busy: boolean; error: string; source: string }>({ busy: false, error: '', source: '' })
  const parsed = useMemo(() => parseDeckList(text), [text])

  const cardCount = parsed.lines.reduce((n, l) => n + l.quantity, 0)
  const commanderCount = parsed.lines.filter((l) => l.section === 'commander').length
  const batches = useMemo(() => {
    const out = []
    for (let i = 0; i < parsed.lines.length; i += MAX_BATCH_LINES) out.push(parsed.lines.slice(i, i + MAX_BATCH_LINES))
    return out
  }, [parsed])

  /** Lit le deck sur Moxfield ou Archidekt et remplit la liste ; l'import reste à lancer. */
  async function fetchLink() {
    setLinkState({ busy: true, error: '', source: '' })
    const { error, data } = await sendJson(`/api/decks/${deckId}/import/link`, 'POST', { url: link })
    if (error) return setLinkState({ busy: false, error, source: '' })
    const { text: fetched, name } = data as { text: string; name: string | null }
    setText(fetched)
    setLinkState({ busy: false, error: '', source: name ?? '' })
  }

  async function resolveBatch(index: number): Promise<string | null> {
    const url = `/api/decks/${deckId}/import/resolve`
    const first = await sendJson(url, 'POST', { lines: batches[index] })
    if (!first.error) return null
    await wait(2000)
    return (await sendJson(url, 'POST', { lines: batches[index] })).error
  }

  async function run(from: number) {
    setCommitError('')
    for (let i = from; i < batches.length; i++) {
      setPhase({ step: 'resolving', done: i, total: batches.length })
      const error = await resolveBatch(i)
      if (error) return setPhase({ step: 'failed', done: i, total: batches.length, error })
    }
    setPhase({ step: 'committing' })
    const { error, data } = await sendJson(`/api/decks/${deckId}/import/commit`, 'POST', { text })
    if (error) {
      setCommitError(error)
      return setPhase({ step: 'edit' })
    }
    const summary = data as ImportSummary
    setPhase({ step: 'done', summary })
    onDone(summary.total)
  }

  if (phase.step === 'done') {
    const { summary } = phase
    const percent = summary.total ? Math.round((summary.frenchCount / summary.total) * 100) : 0
    return (
      <div className="space-y-3">
        <p className="text-dc-text text-sm">
          <strong>{summary.total} cartes</strong> importées · {percent} % en français
          {summary.commanders === 0 && ' · aucun commandant détecté (à définir sur la page du deck)'}
        </p>
        {summary.notFound.length > 0 && (
          <div className={errorClass + ' text-left'}>
            <p className="font-semibold mb-1">{summary.notFound.length} carte(s) introuvable(s) :</p>
            <ul className="text-xs space-y-0.5">
              {summary.notFound.map((n) => (
                <li key={n.lineNumber}>ligne {n.lineNumber} : {n.text}</li>
              ))}
            </ul>
          </div>
        )}
        <Link href={`/decks/${deckId}`} className="inline-block text-dc-gold text-sm hover:underline">Voir le deck →</Link>
      </div>
    )
  }

  const busy = phase.step === 'resolving' || phase.step === 'committing'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className={inputClass + ' flex-1 min-w-0'}
          type="url"
          value={link}
          disabled={busy || linkState.busy}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && link.trim() && fetchLink()}
          placeholder="Lien Moxfield ou Archidekt (https://moxfield.com/decks/…)"
          aria-label="Lien du deck"
        />
        <button className={primaryButtonClass.replace('w-full', 'w-auto') + ' shrink-0 px-4 !py-2.5'} disabled={busy || linkState.busy || !link.trim()} onClick={fetchLink}>
          <span className="inline-flex items-center gap-2"><Link2 className="w-4 h-4" /> {linkState.busy ? 'Récupération…' : 'Récupérer'}</span>
        </button>
      </div>
      {linkState.error && <p className={errorClass} data-testid="link-error">{linkState.error}</p>}
      {linkState.source && <p className="text-dc-muted text-xs" data-testid="link-ok">Liste de « {linkState.source} » récupérée : vérifie-la puis clique sur Importer.</p>}
      <textarea
        className={inputClass + ' font-mono text-xs'}
        rows={12}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Commander\n1 Kenrith, the Returned King (ELD) 303\n\nDeck\n1 Sol Ring (C21) 263\n…'}
      />
      <p className="text-dc-muted text-xs">
        Ou colle la liste en texte (Moxfield : Export → Copier). {cardCount} cartes · {commanderCount} commandant(s) ·{' '}
        {parsed.ignored} ligne(s) ignorée(s) · {parsed.errors.length} illisible(s)
      </p>
      {parsed.errors.length > 0 && (
        <ul className="text-xs text-dc-red-light space-y-0.5">
          {parsed.errors.map((e) => (
            <li key={e.lineNumber}>ligne {e.lineNumber} illisible : {e.text}</li>
          ))}
        </ul>
      )}
      {parsed.tooLong && <p className={errorClass}>La liste dépasse 250 lignes</p>}
      {commitError && <p className={errorClass}>{commitError}</p>}

      {(phase.step === 'resolving' || phase.step === 'failed') && (
        <div className="space-y-1">
          <div className="h-2 bg-dc-bg border border-dc-border rounded-full overflow-hidden">
            <div className="h-full bg-dc-gold/60 transition-all" style={{ width: `${(phase.done / phase.total) * 100}%` }} />
          </div>
          <p className="text-dc-muted text-xs">
            {Math.min(phase.done * MAX_BATCH_LINES, parsed.lines.length)}/{parsed.lines.length} lignes…
          </p>
        </div>
      )}
      {phase.step === 'committing' && <p className="text-dc-muted text-xs">Enregistrement…</p>}

      {phase.step === 'failed' ? (
        <div className="space-y-2">
          <p className={errorClass}>{phase.error}</p>
          <button className={primaryButtonClass} onClick={() => run(phase.done)}>Reprendre l&apos;import</button>
        </div>
      ) : (
        <button className={primaryButtonClass} disabled={busy || cardCount === 0 || parsed.tooLong} onClick={() => run(0)}>
          <span className="inline-flex items-center gap-2"><Upload className="w-4 h-4" /> {busy ? 'Import en cours…' : 'Importer'}</span>
        </button>
      )}
    </div>
  )
}
