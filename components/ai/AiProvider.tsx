'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { gathererUrl } from '@/lib/cards/oracle'
import type { CardRow } from '@/lib/cards/types'
import { aiReducer, initialAiState, type AiAction, type AiCardRef, type AiState } from './state'
import AiPanel from './AiPanel'

export type { AiCardRef } from './state'

type AiContext = { open(card?: AiCardRef): void; addCard(card: AiCardRef): void }

const Context = createContext<AiContext | null>(null)

/** Carte du site → référence pour l'assistant (nom français si connu). */
export function aiCardRef(en: CardRow, fr: CardRow | null): AiCardRef {
  return { oracleId: en.oracle_id, name: fr?.printed_name ?? en.name, gathererUrl: gathererUrl(en, fr) }
}

/**
 * Assistant IA de la page : rien pour un visiteur ni quand la fonction est désactivée (pas de clé Gemini,
 * ou serveur qui ne connaît pas encore la route) ; sinon un panneau unique, ouvert par useAi().
 */
export default function AiProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const [state, dispatch] = useReducer(aiReducer, initialAiState)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let live = true
    fetch('/api/ai/quota')
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { enabled?: boolean; remaining?: number }
        if (!live || !res.ok || body.enabled !== true) return
        setEnabled(true)
        if (typeof body.remaining === 'number') dispatch({ type: 'quota', remaining: body.remaining })
      })
      .catch(() => undefined)
    return () => { live = false }
  }, [signedIn])

  const open = useCallback((card?: AiCardRef) => dispatch({ type: 'open', card }), [])
  const addCard = useCallback((card: AiCardRef) => dispatch({ type: 'add', card }), [])
  const value = useMemo(() => (enabled ? { open, addCard } : null), [enabled, open, addCard])

  return (
    <Context.Provider value={value}>
      {children}
      {enabled && state.open && <AiPanel state={state} dispatch={dispatch} />}
    </Context.Provider>
  )
}

/** null hors fournisseur, pour un visiteur ou si l'assistant est désactivé : ne rien afficher. */
export function useAi(): AiContext | null {
  return useContext(Context)
}

export type AiDispatch = (action: AiAction) => void
export type { AiState }
