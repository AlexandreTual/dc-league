'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, ExternalLink, Pencil, Plus, RotateCw, Trash2, Upload, X } from 'lucide-react'
import ImportPanel, { ImportProgressBar, ImportResult } from '@/components/decks/ImportPanel'
import { importDeckFromLink, importDeckText, type ImportOutcome, type ImportProgress } from '@/components/decks/importDeck'
import type { ImportSummary } from '@/lib/cards/types'
import type { DbDeck } from '@/lib/db-decks'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

// L'image du commandant vient de l'import de la liste (carte en section commandant).
type DeckFields = { name: string; moxfield_url: string }
const emptyFields: DeckFields = { name: '', moxfield_url: '' }

function fieldsOf(deck: DbDeck): DeckFields {
  return { name: deck.name, moxfield_url: deck.moxfield_url ?? '' }
}

/** État de l'import en un clic d'un deck (lien Moxfield ou Archidekt → Scryfall → enregistrement). */
type ImportState =
  | { step: 'running'; progress: ImportProgress }
  | { step: 'failed'; error: string; text: string; resumeFrom?: number }
  | { step: 'done'; summary: ImportSummary }

function DeckForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: DeckFields
  submitLabel: (fields: DeckFields) => string
  onSubmit: (fields: DeckFields) => Promise<string | null>
  onCancel?: () => void
}) {
  const [fields, setFields] = useState(initial)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: keyof DeckFields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [k]: e.target.value })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const err = await onSubmit(fields)
    setLoading(false)
    setError(err ?? '')
    if (!err && !onCancel) setFields(emptyFields)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Nom du deck (ou du commandant)</label>
        <input className={inputClass} value={fields.name} onChange={set('name')} placeholder="Kenrith" />
      </div>
      <div>
        <label className={labelClass}>Lien du deck (Moxfield ou Archidekt)</label>
        <input className={inputClass} type="url" value={fields.moxfield_url} onChange={set('moxfield_url')} placeholder="https://moxfield.com/decks/…" />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !fields.name.trim()} className={primaryButtonClass}>{submitLabel(fields)}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 rounded-xl border border-dc-border text-dc-muted hover:text-dc-text">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
  )
}

/** Progression, résultat ou erreur de l'import en un clic, sous la ligne du deck. */
function ImportStatus({ deck, state, onRetry, onResume, onPaste }: {
  deck: DbDeck
  state: ImportState | undefined
  onRetry: () => void
  onResume: (id: string, text: string, from: number) => void
  onPaste: () => void
}) {
  if (!state) return null
  return (
    <div className="mt-4 pt-4 border-t border-dc-border space-y-2">
      {state.step === 'running' && <ImportProgressBar progress={state.progress} />}
      {state.step === 'done' && <ImportResult deckId={deck.id} summary={state.summary} />}
      {state.step === 'failed' && (
        <>
          <p className={errorClass} data-testid="import-error">{state.error}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => (state.resumeFrom !== undefined ? onResume(deck.id, state.text, state.resumeFrom) : onRetry())}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-gold/40 rounded-lg text-dc-gold hover:bg-dc-gold/10"
            >
              <RotateCw className="w-3.5 h-3.5" /> {state.resumeFrom !== undefined ? 'Reprendre l\'import' : 'Réessayer'}
            </button>
            <button onClick={onPaste} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border/60 rounded-lg text-dc-muted hover:text-dc-text">
              <ClipboardPaste className="w-3.5 h-3.5" /> Coller la liste à la place
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function MyDecks({ playerId, initialDecks, cardCounts: initialCounts }: {
  playerId: string
  initialDecks: DbDeck[]
  cardCounts: Record<string, number>
}) {
  const router = useRouter()
  const [decks, setDecks] = useState(initialDecks)
  const [cardCounts, setCardCounts] = useState(initialCounts)
  const [imports, setImports] = useState<Record<string, ImportState>>({})
  const [pastingId, setPastingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [listError, setListError] = useState('')

  const setImport = (id: string, state: ImportState) => setImports((prev) => ({ ...prev, [id]: state }))

  /** Après un import : nombre de cartes et image du commandant à jour, sans recharger la page. */
  async function imported(id: string, summary: ImportSummary) {
    setCardCounts((prev) => ({ ...prev, [id]: summary.total }))
    const { error, data } = await sendJson(`/api/players/${playerId}/decks`, 'GET')
    if (!error && Array.isArray(data)) setDecks(data as DbDeck[])
    router.refresh()
  }

  async function finish(id: string, outcome: ImportOutcome) {
    if (!outcome.ok) return setImport(id, { step: 'failed', error: outcome.error, text: outcome.text, resumeFrom: outcome.resumeFrom })
    setImport(id, { step: 'done', summary: outcome.summary })
    await imported(id, outcome.summary)
  }

  /** Un seul clic : lit le lien du deck, complète chaque carte avec Scryfall et enregistre. Sans lien, on colle la liste. */
  async function startImport(deck: DbDeck) {
    if (!deck.moxfield_url) return setPastingId((prev) => (prev === deck.id ? null : deck.id))
    setPastingId(null)
    const onProgress = (progress: ImportProgress) => setImport(deck.id, { step: 'running', progress })
    await finish(deck.id, await importDeckFromLink(deck.id, deck.moxfield_url, { onProgress }))
  }

  /** Reprend au paquet Scryfall raté, avec la liste déjà récupérée. */
  async function resumeImport(id: string, text: string, from: number) {
    const onProgress = (progress: ImportProgress) => setImport(id, { step: 'running', progress })
    await finish(id, await importDeckText(id, text, from, { onProgress }))
  }

  async function create(fields: DeckFields) {
    const { error, data } = await sendJson(`/api/players/${playerId}/decks`, 'POST', fields)
    if (error) return error
    const deck = data as DbDeck
    setDecks((prev) => [...prev, deck])
    if (deck.moxfield_url) void startImport(deck)
    return null
  }

  async function update(id: string, fields: DeckFields) {
    const { error, data } = await sendJson(`/api/decks/${id}`, 'PATCH', fields)
    if (!error) {
      setDecks((prev) => prev.map((d) => (d.id === id ? (data as DbDeck) : d)))
      setEditingId(null)
    }
    return error
  }

  async function remove(deck: DbDeck) {
    if (!confirm(`Supprimer le deck « ${deck.name} » ?`)) return
    const { error } = await sendJson(`/api/decks/${deck.id}`, 'DELETE')
    setListError(error ?? '')
    if (!error) setDecks((prev) => prev.filter((d) => d.id !== deck.id))
  }

  return (
    <div className="space-y-6">
      {listError && <p className={errorClass}>{listError}</p>}

      {decks.length === 0 && <p className="text-dc-muted text-sm">Tu n&apos;as encore aucun deck.</p>}

      <ul className="space-y-3">
        {decks.map((deck) => (
          <li key={deck.id} className="bg-dc-surface border border-dc-border rounded-2xl p-4">
            {editingId === deck.id ? (
              <DeckForm initial={fieldsOf(deck)} submitLabel={() => 'Enregistrer'} onSubmit={(f) => update(deck.id, f)} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="flex items-center gap-4">
                {deck.commander_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={deck.commander_image_url} alt="" className="w-12 h-16 rounded object-cover border border-dc-border" />
                ) : (
                  <div className="w-12 h-16 rounded bg-dc-bg border border-dc-border" />
                )}
                <div className="flex-1 min-w-0">
                  {cardCounts[deck.id] ? (
                    <Link href={`/decks/${deck.id}`} className="text-dc-text font-semibold truncate block hover:text-dc-gold">{deck.name}</Link>
                  ) : (
                    <p className="text-dc-text font-semibold truncate">{deck.name}</p>
                  )}
                  {cardCounts[deck.id] ? <p className="text-dc-muted text-xs">{cardCounts[deck.id]} cartes</p> : null}
                  {deck.moxfield_url && (
                    <a href={deck.moxfield_url} target="_blank" rel="noreferrer" className="text-dc-gold text-xs inline-flex items-center gap-1 hover:underline">
                      {deck.moxfield_url.includes('archidekt') ? 'Archidekt' : 'Moxfield'} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => startImport(deck)}
                  disabled={imports[deck.id]?.step === 'running'}
                  aria-label={`Importer ${deck.name}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border/60 rounded-lg text-dc-muted hover:text-dc-gold hover:border-dc-gold/40 disabled:opacity-40"
                >
                  <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{cardCounts[deck.id] ? 'Réimporter' : 'Importer'}</span>
                </button>
                <button onClick={() => setEditingId(deck.id)} className="p-2 text-dc-muted hover:text-dc-text" aria-label={`Modifier ${deck.name}`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(deck)} className="p-2 text-dc-muted hover:text-dc-red-light" aria-label={`Supprimer ${deck.name}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            {editingId !== deck.id && pastingId !== deck.id && <ImportStatus deck={deck} state={imports[deck.id]} onRetry={() => startImport(deck)} onResume={resumeImport} onPaste={() => setPastingId(deck.id)} />}
            {pastingId === deck.id && editingId !== deck.id && (
              <div className="mt-4 pt-4 border-t border-dc-border">
                {!deck.moxfield_url && <p className="text-dc-muted text-xs mb-2">Ajoute un lien Moxfield ou Archidekt (bouton ✎) pour importer en un clic, ou colle la liste :</p>}
                <ImportPanel
                  deckId={deck.id}
                  initialText={imports[deck.id]?.step === 'failed' ? (imports[deck.id] as { text: string }).text : ''}
                  onDone={(summary) => {
                    setImport(deck.id, { step: 'done', summary })
                    setPastingId(null)
                    void imported(deck.id, summary)
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className={cardClass}>
        <h2 className="font-fantasy text-lg text-dc-text flex items-center gap-2"><Plus className="w-4 h-4" /> Nouveau deck</h2>
        <DeckForm initial={emptyFields} submitLabel={(f) => (f.moxfield_url.trim() ? 'Créer et importer' : 'Créer le deck')} onSubmit={create} />
        <p className="text-dc-muted text-xs">Colle le lien du deck : les cartes sont importées depuis Scryfall dès la création.</p>
      </div>
    </div>
  )
}
