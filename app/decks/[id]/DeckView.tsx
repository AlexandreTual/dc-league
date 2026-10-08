'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Crown, ExternalLink, LayoutGrid, List, Play, RefreshCw, Sparkles, X } from 'lucide-react'
import type { DbDeck } from '@/lib/db-decks'
import type { DeckCardView } from '@/lib/cards/types'
import { displayCard, displayName, groupDeckCards, type Lang } from '@/lib/cards/groups'
import { cardSrcSet } from '@/lib/cards/images'
import { readLang, saveLang } from '@/lib/cards/lang'
import { readDeckView, saveDeckView, type DeckViewMode } from '@/lib/cards/deck-view'
import { sendJson } from '@/components/formStyles'
import ImportPanel, { ImportProgressBar } from '@/components/decks/ImportPanel'
import { importDeckFromLink, type ImportProgress } from '@/components/decks/importDeck'
import type { ImportSummary } from '@/lib/cards/types'
import { deckSiteName } from '@/lib/cards/deck-link'
import OracleModal from '@/components/OracleModal'
import { longPressClass, menuGesture, touchTarget } from '@/components/table/touch'

export default function DeckView({ deck, playerName, cards, canEdit }: {
  deck: DbDeck
  playerName: string
  cards: DeckCardView[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('fr')
  const [view, setView] = useState<DeckViewMode>('images')
  const [hover, setHover] = useState<{ card: DeckCardView; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<DeckCardView | null>(null)
  const [oracle, setOracle] = useState<DeckCardView | null>(null)
  const [error, setError] = useState('')
  const [tokensStatus, setTokensStatus] = useState('')
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importStatus, setImportStatus] = useState('')
  const [importFailed, setImportFailed] = useState(false)
  const [pasting, setPasting] = useState(false)

  useEffect(() => {
    setLang(readLang())
    setView(readDeckView())
  }, [])
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  function toggleLang() {
    const next = lang === 'fr' ? 'en' : 'fr'
    setLang(next)
    saveLang(next)
  }

  function chooseView(next: DeckViewMode) {
    setHover(null)
    setView(next)
    saveDeckView(next)
  }

  async function makeCommander(card: DeckCardView) {
    const { error } = await sendJson(`/api/decks/${deck.id}/commander`, 'PATCH', { position: card.position })
    if (error) return setError(error)
    setSelected(null)
    router.refresh()
  }

  async function updateTokens() {
    setError('')
    setTokensStatus('Recherche des jetons…')
    const { data, error } = await sendJson(`/api/decks/${deck.id}/tokens`, 'POST', {})
    if (error) {
      setTokensStatus('')
      return setError(error)
    }
    const count = (data as { count?: number } | null)?.count ?? 0
    setTokensStatus(count === 0 ? 'Aucun jeton dans ce deck' : `${count} jeton${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''}`)
  }

  /** Réimport direct depuis le lien du deck (Moxfield ou Archidekt → Scryfall), sans passer par la liste des decks. */
  async function reimport() {
    setError('')
    setImportStatus('')
    setImportFailed(false)
    if (!deck.moxfield_url) return setPasting((open) => !open)
    setPasting(false)
    const outcome = await importDeckFromLink(deck.id, deck.moxfield_url, { onProgress: setImportProgress })
    setImportProgress(null)
    if (!outcome.ok) {
      setImportFailed(true)
      return setError(outcome.error)
    }
    showImported(outcome.summary)
  }

  function showImported({ total, frenchCount, notFound }: ImportSummary) {
    const percent = total ? Math.round((frenchCount / total) * 100) : 0
    setImportStatus(`${total} cartes importées · ${percent} % en français${notFound.length ? ` · ${notFound.length} introuvable(s) : ${notFound.map((n) => n.text).join(', ')}` : ''}`)
    router.refresh()
  }

  const total = cards.reduce((n, c) => n + c.quantity, 0)
  const groups = groupDeckCards(cards, lang)
  const selectedShown = selected ? displayCard(selected, lang) : null
  const hoverShown = hover ? displayCard(hover.card, lang) : null
  const hoverImage = hoverShown?.image_normal ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {deck.commander_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deck.commander_image_url} alt="" className="w-20 h-28 rounded-lg object-cover border border-dc-gold/40" />
        ) : (
          <div className="w-20 h-28 rounded-lg bg-dc-surface border border-dc-border" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-fantasy text-2xl font-bold text-dc-gold break-words">{deck.name}</h1>
          <p className="text-dc-muted text-sm">
            {playerName} · {total} cartes
            {deck.moxfield_url && (
              <a href={deck.moxfield_url} target="_blank" rel="noreferrer" className="ml-2 text-dc-gold inline-flex items-center gap-1 hover:underline">
                {deckSiteName(deck.moxfield_url) ?? 'Lien du deck'} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggleLang} className="text-xs px-3 py-1.5 border border-dc-border rounded-lg text-dc-text hover:border-dc-gold/40" aria-label="Changer la langue des cartes">
            <span className={lang === 'fr' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>FR</span>
            {' / '}
            <span className={lang === 'en' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>EN</span>
          </button>
          {canEdit && (
            <button
              onClick={reimport}
              disabled={importProgress !== null}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border rounded-lg text-dc-muted hover:text-dc-gold disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5${importProgress ? ' animate-spin' : ''}`} /> {importProgress ? 'Import en cours…' : cards.length ? 'Réimporter' : 'Importer'}
            </button>
          )}
          {canEdit && cards.length > 0 && (
            <button onClick={updateTokens} disabled={tokensStatus === 'Recherche des jetons…'} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-border rounded-lg text-dc-muted hover:text-dc-gold disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5" /> Mettre à jour les jetons
            </button>
          )}
          {cards.length > 0 && (
            <Link href={`/decks/${deck.id}/test`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dc-gold/40 rounded-lg text-dc-gold hover:bg-dc-gold/10">
              <Play className="w-3.5 h-3.5" /> Tester le deck
            </Link>
          )}
        </div>
      </div>

      {error && <p className="text-dc-red-light text-sm">{error}</p>}
      {importProgress && <ImportProgressBar progress={importProgress} />}
      {importFailed && !pasting && (
        <button onClick={() => setPasting(true)} className="text-xs px-3 py-1.5 border border-dc-border rounded-lg text-dc-muted hover:text-dc-text">
          Coller la liste à la place
        </button>
      )}
      {pasting && (
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-4 space-y-2">
          {!deck.moxfield_url && <p className="text-dc-muted text-xs">Ajoute un lien Moxfield ou Archidekt (Mes decks → ✎) pour réimporter en un clic, ou colle la liste :</p>}
          <ImportPanel
            deckId={deck.id}
            onDone={(summary) => {
              setPasting(false)
              setImportFailed(false)
              setError('')
              showImported(summary)
            }}
          />
        </div>
      )}
      {importStatus && <p className="text-dc-muted text-sm" role="status" data-testid="reimport-done">{importStatus}</p>}
      {tokensStatus && <p className="text-dc-muted text-sm" role="status">{tokensStatus}</p>}

      {cards.length === 0 ? (
        <p className="text-dc-muted text-sm">Ce deck n&apos;a pas encore de liste importée.</p>
      ) : (
        <>
          <div className="flex justify-end">
            <div role="group" aria-label="Affichage des cartes" className="inline-flex rounded-lg border border-dc-border p-0.5 text-xs">
              {([['images', 'Visuels', LayoutGrid], ['list', 'Liste', List]] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => chooseView(mode)}
                  aria-pressed={view === mode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${view === mode ? 'bg-dc-gold/15 text-dc-gold' : 'text-dc-muted hover:text-dc-text'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          {view === 'images' ? (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.group}>
                  <h2 className="font-fantasy text-dc-gold text-sm mb-2">{g.label} ({g.count})</h2>
                  <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {g.cards.map((card) => {
                      const shown = displayCard(card, lang)
                      const image = shown?.image_normal ?? shown?.faces?.find((f) => f.image_normal)?.image_normal ?? null
                      const name = displayName(card, lang)
                      // Clic droit ou appui long sur le visuel : fenêtre « Oracle et règles ».
                      const openOracle = card.en ? () => setOracle(card) : undefined
                      return (
                        <li key={card.position} data-deck-card={card.en?.name ?? card.requested_name}>
                          <button
                            className={`relative block w-full aspect-[63/88] rounded-lg overflow-hidden bg-dc-surface border border-dc-border hover:border-dc-gold/60 ${openOracle ? longPressClass : ''}`}
                            onClick={() => shown && setSelected(card)}
                            aria-label={card.quantity > 1 ? `${card.quantity} × ${name}` : name}
                            title={name}
                            {...menuGesture(openOracle)}
                          >
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover" />
                            ) : (
                              <span className={`absolute inset-0 p-2 text-xs text-left break-words ${shown ? 'text-dc-text' : 'text-dc-red-light'}`}>{name}</span>
                            )}
                            {/* Quantité sur l’illustration, pour ne cacher ni le nom ni le coût de la carte. */}
                            {card.quantity > 1 && (
                              <span className="absolute top-[40%] left-1 min-w-6 px-1.5 py-0.5 rounded-md bg-black/80 text-dc-gold text-xs font-semibold">×{card.quantity}</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {groups.map((g) => (
                <section key={g.group} className="bg-dc-surface border border-dc-border rounded-2xl p-4">
                  <h2 className="font-fantasy text-dc-gold text-sm mb-2">{g.label} ({g.count})</h2>
                  <ul className="space-y-0.5">
                    {g.cards.map((card) => {
                      const shown = displayCard(card, lang)
                      // Clic droit ou appui long sur la ligne, ou l'icône : fenêtre « Oracle et règles ».
                      const openOracle = card.en ? () => { setHover(null); setOracle(card) } : undefined
                      return (
                        <li key={card.position} className="flex items-center gap-1" data-deck-card={card.en?.name ?? card.requested_name}>
                          <button
                            className={`flex-1 min-w-0 flex items-center gap-2 text-left text-sm px-2 py-1 rounded hover:bg-dc-border/50 ${openOracle ? longPressClass : ''}`}
                            onMouseMove={(e) => shown && setHover({ card, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => shown && setSelected(card)}
                            {...menuGesture(openOracle)}
                          >
                            <span className="text-dc-muted w-6 text-right shrink-0">{card.quantity}</span>
                            <span className={shown ? 'text-dc-text flex-1 truncate' : 'text-dc-red-light flex-1 truncate'}>{displayName(card, lang)}</span>
                            {/* Coût de mana masqué sur téléphone : le nom de la carte passe avant. */}
                            {shown?.mana_cost && <span className="hidden sm:inline text-dc-muted text-xs font-mono shrink-0">{shown.mana_cost}</span>}
                          </button>
                          {openOracle && (
                            <button
                              onClick={openOracle}
                              className={`shrink-0 p-1 rounded text-dc-muted hover:text-dc-gold ${touchTarget}`}
                              aria-label={`Oracle et règles : ${displayName(card, lang)}`}
                              title="Oracle et règles"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {oracle?.en && <OracleModal en={oracle.en} fr={oracle.fr} onClose={() => setOracle(null)} />}

      {view === 'list' && hover && hoverImage && !selected && !oracle && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hoverImage}
          srcSet={cardSrcSet(hoverImage, hoverShown?.image_large)}
          sizes="224px"
          alt=""
          className="hidden md:block fixed z-40 w-56 rounded-xl shadow-card pointer-events-none"
          style={{ left: Math.min(hover.x + 24, window.innerWidth - 240), top: Math.max(8, Math.min(hover.y - 150, window.innerHeight - 320)) }}
        />
      )}

      {selected && selectedShown && (
        // Défilable : une carte recto-verso est plus haute qu'un écran de téléphone, et les boutons restent atteignables.
        <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto overscroll-contain" onClick={() => setSelected(null)}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end gap-2 mb-2">
                {selected.en && (
                  <button
                    onClick={() => { setOracle(selected); setSelected(null) }}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dc-border bg-dc-surface text-dc-muted hover:text-dc-gold"
                  >
                    <BookOpen className="w-4 h-4" /> Oracle et règles
                  </button>
                )}
                <button onClick={() => setSelected(null)} className={`p-1.5 rounded-lg text-dc-muted hover:text-dc-text ${touchTarget}`} aria-label="Fermer">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                {(selectedShown.faces?.some((f) => f.image_normal) ? selectedShown.faces : [selectedShown])
                  .filter((img): img is typeof img & { image_normal: string } => !!img.image_normal)
                  .map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.image_normal}
                      src={img.image_normal}
                      // max-w-xs (320 px), moins les marges sur petit écran : image large sur écran haute densité.
                      srcSet={cardSrcSet(img.image_normal, img.image_large)}
                      sizes="(max-width: 352px) calc(100vw - 32px), 320px"
                      alt=""
                      className="w-full max-w-xs rounded-2xl shadow-card"
                    />
                  ))}
              </div>
              {canEdit && selected.section !== 'commander' && selected.en?.type_line.includes('Legendary') && (
                <div className="text-center mt-4">
                  <button onClick={() => makeCommander(selected)} className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-dc-gold/20 border border-dc-gold/40 text-dc-gold rounded-xl hover:bg-dc-gold/30">
                    <Crown className="w-4 h-4" /> Définir comme commandant
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
