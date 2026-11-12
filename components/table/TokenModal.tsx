'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { customToken, searchTokens } from '@/lib/game/tokens'
import type { DeckToken, TokenData } from '@/lib/game/types'
import { useT } from '@/components/i18n/I18nProvider'

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const
const input = 'bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-sm text-dc-text'

type Tab = 'deck' | 'search' | 'custom'

/** Grille de jetons (image, nom, force/endurance), avec en petit les cartes du deck qui les créent. */
function TokenGrid({ tokens, onPick }: { tokens: (TokenData & { sources?: string[] })[]; onPick: (token: TokenData) => void }) {
  const k = useT().table.token
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
      {tokens.map((t, i) => (
        <button key={`${t.name}-${i}`} onClick={() => onPick(t)} className="text-left space-y-1" title={t.typeLine}>
          {t.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.image} alt={t.name} className="w-full rounded-lg" />
          ) : (
            <div className="aspect-[63/88] rounded-lg border border-dc-border" />
          )}
          <span className="block text-xs text-dc-text">{t.name}{t.power != null && ` ${t.power}/${t.toughness}`}</span>
          {t.sources && t.sources.length > 0 && <span className="block text-[10px] leading-tight text-dc-muted">{k.sources(t.sources.join(', '))}</span>}
        </button>
      ))}
    </div>
  )
}

/** Jeton à créer, sans les informations propres à l'onglet « Du deck » ; avec ses capacités imprimées s'il en a (vol…). */
function asToken({ name, typeLine, power, toughness, colors, image, keywords }: TokenData): TokenData {
  return { name, typeLine, power, toughness, colors, image, ...(keywords?.length ? { keywords } : {}) }
}

export default function TokenModal({ deckTokens, onCreate, onClose }: {
  /** Jetons du deck du joueur ; absent (ancien serveur, chargement) ou vide : pas d'onglet « Du deck ». */
  deckTokens?: DeckToken[]
  onCreate: (token: TokenData) => void
  onClose: () => void
}) {
  const t = useT()
  const k = t.table.token
  const hasDeckTokens = (deckTokens?.length ?? 0) > 0
  const [tab, setTab] = useState<Tab>(hasDeckTokens ? 'deck' : 'search')
  const tabs: Tab[] = hasDeckTokens ? ['deck', 'search', 'custom'] : ['search', 'custom']
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TokenData[]>([])
  const [status, setStatus] = useState('')
  const [custom, setCustom] = useState({ name: '', power: '1', toughness: '1', colors: [] as string[] })

  useEffect(() => {
    if (tab !== 'search' || query.trim().length < 2) return
    const timer = setTimeout(async () => {
      setStatus(k.searching)
      try {
        const tokens = await searchTokens(fetch, query)
        setResults(tokens)
        setStatus(tokens.length ? '' : k.none)
      } catch {
        setResults([])
        setStatus(k.scryfallDown)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, tab, k])

  const create = (token: TokenData) => {
    onCreate(asToken(token))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={k.title}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-dc-border">
          {tabs.map((id) => (
            <button key={id} onClick={() => setTab(id)} className={`text-sm px-3 py-1 rounded-lg ${tab === id ? 'bg-dc-gold/20 text-dc-gold' : 'text-dc-muted'}`}>
              {k.tabs[id]}
            </button>
          ))}
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label={t.common.close}><X className="w-5 h-5" /></button>
        </div>

        {tab === 'deck' && hasDeckTokens ? (
          <div className="p-4 overflow-y-auto">
            <TokenGrid tokens={deckTokens!} onPick={create} />
          </div>
        ) : tab === 'search' ? (
          <div className="p-4 space-y-3 overflow-y-auto">
            <input autoFocus className={`${input} w-full`} placeholder={k.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            {status && <p className="text-dc-muted text-sm">{status}</p>}
            <TokenGrid tokens={results} onPick={create} />
          </div>
        ) : (
          <form
            className="p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              create(customToken(custom))
            }}
          >
            <input autoFocus className={`${input} w-full`} placeholder={k.namePlaceholder} value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <div className="flex items-center gap-2 text-sm text-dc-muted">
              {k.pt}
              <input className={`${input} w-16`} value={custom.power} onChange={(e) => setCustom({ ...custom, power: e.target.value })} aria-label={k.power} />
              /
              <input className={`${input} w-16`} value={custom.toughness} onChange={(e) => setCustom({ ...custom, toughness: e.target.value })} aria-label={k.toughness} />
              <span className="text-xs">{k.ptHint}</span>
            </div>
            <div className="flex gap-3 text-sm text-dc-text">
              {COLORS.map((code) => (
                <label key={code} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={custom.colors.includes(code)}
                    onChange={(e) => setCustom({ ...custom, colors: e.target.checked ? [...custom.colors, code] : custom.colors.filter((c) => c !== code) })}
                  />
                  {k.colors[code]}
                </label>
              ))}
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold">{k.create}</button>
          </form>
        )}
      </div>
    </div>
  )
}
