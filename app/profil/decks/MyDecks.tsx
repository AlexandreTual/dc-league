'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import ImportPanel from '@/components/decks/ImportPanel'
import type { DbDeck } from '@/lib/db-decks'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

// L'image du commandant vient de l'import de la liste (carte en section commandant).
type DeckFields = { name: string; moxfield_url: string }
const emptyFields: DeckFields = { name: '', moxfield_url: '' }

function fieldsOf(deck: DbDeck): DeckFields {
  return { name: deck.name, moxfield_url: deck.moxfield_url ?? '' }
}

function DeckForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: DeckFields
  submitLabel: string
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
        <label className={labelClass}>Nom du deck</label>
        <input className={inputClass} value={fields.name} onChange={set('name')} placeholder="Kenrith Group Hug" />
      </div>
      <div>
        <label className={labelClass}>Lien du deck (Moxfield ou Archidekt)</label>
        <input className={inputClass} value={fields.moxfield_url} onChange={set('moxfield_url')} placeholder="https://moxfield.com/decks/…" />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !fields.name.trim()} className={primaryButtonClass}>{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 rounded-xl border border-dc-border text-dc-muted hover:text-dc-text">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
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
  const [importingId, setImportingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [listError, setListError] = useState('')

  async function create(fields: DeckFields) {
    const { error, data } = await sendJson(`/api/players/${playerId}/decks`, 'POST', fields)
    if (!error) setDecks((prev) => [...prev, data as DbDeck])
    return error
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
              <DeckForm initial={fieldsOf(deck)} submitLabel="Enregistrer" onSubmit={(f) => update(deck.id, f)} onCancel={() => setEditingId(null)} />
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
                  onClick={() => setImportingId(importingId === deck.id ? null : deck.id)}
                  aria-label={`Importer la liste de ${deck.name}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border/60 rounded-lg text-dc-muted hover:text-dc-gold hover:border-dc-gold/40"
                >
                  <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importer la liste</span>
                </button>
                <button onClick={() => setEditingId(deck.id)} className="p-2 text-dc-muted hover:text-dc-text" aria-label={`Modifier ${deck.name}`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(deck)} className="p-2 text-dc-muted hover:text-dc-red-light" aria-label={`Supprimer ${deck.name}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            {importingId === deck.id && editingId !== deck.id && (
              <div className="mt-4 pt-4 border-t border-dc-border">
                <ImportPanel
                  deckId={deck.id}
                  defaultLink={deck.moxfield_url ?? ''}
                  onDone={(total) => {
                    setCardCounts((prev) => ({ ...prev, [deck.id]: total }))
                    router.refresh()
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className={cardClass}>
        <h2 className="font-fantasy text-lg text-dc-text flex items-center gap-2"><Plus className="w-4 h-4" /> Nouveau deck</h2>
        <DeckForm initial={emptyFields} submitLabel="Créer le deck" onSubmit={create} />
      </div>
    </div>
  )
}
