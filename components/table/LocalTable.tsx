'use client'

import { useMemo, useState } from 'react'
import type { Catalog, DeckToken } from '@/lib/game/types'
import Table from './Table'
import { useLocalSource } from './useLocalSource'
import { useT } from '@/components/i18n/I18nProvider'

/** Mode test : la table alimentée par une partie locale à un joueur. */
export default function LocalTable({ catalog, excluded, deckName, deckTokens }: {
  catalog: Catalog
  excluded: string[]
  deckName: string
  deckTokens: DeckToken[]
}) {
  const t = useT()
  const l = t.table.local
  const phase = useLocalSource(catalog, deckName)
  const [showExcluded, setShowExcluded] = useState(excluded.length > 0)
  const playing = phase.step === 'playing' ? phase.source : null
  const source = useMemo(() => playing && { ...playing, deckTokens }, [playing, deckTokens])

  if (phase.step === 'loading') return null

  if (phase.step === 'resume') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-6 space-y-4 text-center">
          <p className="font-fantasy text-dc-gold text-lg" data-user-content>{deckName}</p>
          <p className="text-dc-muted text-sm">{l.inProgress}</p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold" onClick={phase.resume}>
              {l.resume(phase.turn)}
            </button>
            <button className="px-4 py-2 rounded-xl border border-dc-border text-dc-text" onClick={phase.restart}>
              {t.table.bar.newGame}
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
          <span>{l.excluded(excluded.join(', '))}</span>
          <button onClick={() => setShowExcluded(false)}>{t.common.close}</button>
        </div>
      )}
    />
  )
}
