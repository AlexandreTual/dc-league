'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameTable } from '@/lib/db-games'
import { sendJson } from '@/components/formStyles'

/** Revanche proposée après une partie finie, telle que je la vois. */
export type RematchOffer = { id: string; hostName: string; seated: boolean }

/**
 * Ce que montre le bandeau de fin : une revanche ouverte (à rejoindre, ou où je suis déjà assis),
 * une revanche commencée seulement si j'y joue ; sinon rien et le bouton « Revanche » reste proposé.
 */
export function rematchOffer(rematch: GameTable | null, me: string): RematchOffer | null {
  if (!rematch) return null
  const seated = rematch.players.some((p) => p.playerId === me)
  if (rematch.status !== 'open' && !(seated && rematch.status === 'playing')) return null
  const hostName = rematch.players.find((p) => p.playerId === rematch.hostPlayerId)?.name ?? '?'
  return { id: rematch.id, hostName, seated }
}

const POLL_MS = 4000

async function fetchTable(id: string): Promise<GameTable | null> {
  const res = await fetch(`/api/games/${id}`).catch(() => null)
  return res?.ok ? ((await res.json().catch(() => null)) as GameTable | null) : null
}

/**
 * Revanche d'une partie en ligne finie (lue dans le salon du site, pas sur le serveur de jeu) :
 * vérifiée toutes les 4 s tant que la partie est finie. `start` la crée ou la rejoint, puis ouvre sa salle d'attente.
 */
export function useRematch(tableId: string, me: string | null, finished: boolean) {
  const router = useRouter()
  const [offer, setOffer] = useState<RematchOffer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!finished || !me) return
    let cancelled = false
    const check = async () => {
      const old = await fetchTable(tableId)
      // Champ absent (base pas encore migrée) : pas de revanche affichée.
      const rematch = old?.rematchTableId ? await fetchTable(old.rematchTableId) : null
      if (!cancelled) setOffer(rematchOffer(rematch, me))
    }
    void check()
    const timer = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [tableId, me, finished])

  const start = useCallback(async () => {
    setBusy(true)
    const { error, data } = await sendJson(`/api/games/${tableId}/rematch`, 'POST')
    if (error || !data || typeof data !== 'object' || !('id' in data)) {
      setBusy(false)
      return setError(error ?? 'Une erreur est survenue')
    }
    router.push(`/tables/${(data as GameTable).id}`)
  }, [tableId, router])

  /** Bouton « Revanche » : ouvre la revanche où je suis déjà assis, sinon la crée ou la rejoint. */
  const go = useCallback(() => {
    if (offer?.seated) router.push(`/tables/${offer.id}`)
    else void start()
  }, [offer, router, start])

  return { offer, busy, error, go }
}
