'use client'

import { useMemo, useState } from 'react'
import type { Catalog, DeckToken } from '@/lib/game/types'
import Table from './Table'
import { useLocalSource } from './useLocalSource'

/** Mode test : la table alimentée par une partie locale à un joueur. */
export default function LocalTable({ catalog, excluded, deckName, deckTokens }: {
  catalog: Catalog
  excluded: string[]
  deckName: string
  deckTokens: DeckToken[]
}) {
  const phase = useLocalSource(catalog, deckName)
  const [showExcluded, setShowExcluded] = useState(excluded.length > 0)
  const playing = phase.step === 'playing' ? phase.source : null
  const source = useMemo(() => playing && { ...playing, deckTokens }, [playing, deckTokens])

  if (phase.step === 'loading') return null

  if (phase.step === 'resume') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-6 space-y-4 text-center">
          <p className="font-fantasy text-dc-gold text-lg">{deckName}</p>
          <p className="text-dc-muted text-sm">Une partie de test est en cours.</p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold" onClick={phase.resume}>
              Reprendre la partie (tour {phase.turn})
            </button>
            <button className="px-4 py-2 rounded-xl border border-dc-border text-dc-text" onClick={phase.restart}>
              Nouvelle partie
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Table
      source={source!}
      notice={showExcluded && (
        <div className="px-3 py-1.5 text-xs bg-dc-red/20 text-dc-red-light flex justify-between">
          <span>Cartes introuvables exclues du test : {excluded.join(', ')}</span>
          <button onClick={() => setShowExcluded(false)}>Fermer</button>
        </div>
      )}
    />
  )
}
