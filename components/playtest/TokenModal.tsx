'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { customToken, searchTokens } from '@/lib/game/tokens'
import type { TokenData } from '@/lib/game/types'

const COLORS: [string, string][] = [['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert']]
const input = 'bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-sm text-dc-text'

export default function TokenModal({ onCreate, onClose }: { onCreate: (token: TokenData) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'search' | 'custom'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TokenData[]>([])
  const [status, setStatus] = useState('')
  const [custom, setCustom] = useState({ name: '', power: '1', toughness: '1', colors: [] as string[] })

  useEffect(() => {
    if (tab !== 'search' || query.trim().length < 2) return
    const timer = setTimeout(async () => {
      setStatus('Recherche…')
      try {
        const tokens = await searchTokens(fetch, query)
        setResults(tokens)
        setStatus(tokens.length ? '' : 'Aucun jeton trouvé')
      } catch {
        setResults([])
        setStatus('Scryfall ne répond pas : utilise l’onglet Personnalisé')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, tab])

  const create = (token: TokenData) => {
    onCreate(token)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Créer un jeton">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-dc-border">
          {(['search', 'custom'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-sm px-3 py-1 rounded-lg ${tab === t ? 'bg-dc-gold/20 text-dc-gold' : 'text-dc-muted'}`}>
              {t === 'search' ? 'Scryfall' : 'Personnalisé'}
            </button>
          ))}
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        {tab === 'search' ? (
          <div className="p-4 space-y-3 overflow-y-auto">
            <input autoFocus className={`${input} w-full`} placeholder="Soldat, Treasure, Zombie… (en anglais)" value={query} onChange={(e) => setQuery(e.target.value)} />
            {status && <p className="text-dc-muted text-sm">{status}</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
              {results.map((t, i) => (
                <button key={`${t.name}-${i}`} onClick={() => create(t)} className="text-left space-y-1" title={t.typeLine}>
                  {t.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image} alt={t.name} className="w-full rounded-lg" />
                  ) : (
                    <div className="aspect-[63/88] rounded-lg border border-dc-border" />
                  )}
                  <span className="text-xs text-dc-text">{t.name}{t.power != null && ` ${t.power}/${t.toughness}`}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form
            className="p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              create(customToken(custom))
            }}
          >
            <input autoFocus className={`${input} w-full`} placeholder="Nom (ex. Soldat)" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <div className="flex items-center gap-2 text-sm text-dc-muted">
              Force / endurance
              <input className={`${input} w-16`} value={custom.power} onChange={(e) => setCustom({ ...custom, power: e.target.value })} aria-label="Force" />
              /
              <input className={`${input} w-16`} value={custom.toughness} onChange={(e) => setCustom({ ...custom, toughness: e.target.value })} aria-label="Endurance" />
              <span className="text-xs">(vides pour un jeton non créature)</span>
            </div>
            <div className="flex gap-3 text-sm text-dc-text">
              {COLORS.map(([code, label]) => (
                <label key={code} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={custom.colors.includes(code)}
                    onChange={(e) => setCustom({ ...custom, colors: e.target.checked ? [...custom.colors, code] : custom.colors.filter((c) => c !== code) })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold">Créer le jeton</button>
          </form>
        )}
      </div>
    </div>
  )
}
