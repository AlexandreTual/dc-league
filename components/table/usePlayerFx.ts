'use client'

import { useEffect, useRef, useState } from 'react'
import { parseRoll } from '@/lib/game/dice'
import { addPops, expirePops, playerChanges, POP_MS, type HolderChange, type Pops } from '@/lib/game/player-fx'
import type { PlayerView } from '@/lib/game/types'
import type { CardEffects } from '@/lib/table-settings'

/** Monarque ou initiative qui passe d'un joueur à l'autre. */
export type Flight = HolderChange & { key: number }
/** Lancer de dés vu au journal : auteur (« Vous » pour le mien), dé et résultats. */
export type RollFx = { key: number; author: string; sides: number; results: number[] }

/** Fissures qui s'ouvrent sur le portrait d'un joueur éliminé. */
export const CRACK_MS = 900
export const FLIGHT_MS = 1100
/** Le dé roule, puis son résultat reste affiché. */
export const ROLL_MS = 900
export const ROLL_SHOW_MS = 2900
export const VICTORY_MS = 8000
const MAX_ROLLS = 3

/**
 * Animations des joueurs et de la partie (spec `2026-10-20-player-animations-design.md`) : ce qui change d'une vue à la
 * suivante, seulement si l'animation est activée ; rien au premier affichage ni à la reconnexion (`status` autre que
 * `open`). La victoire : seulement si la partie a été vue en cours avant de finir.
 */
export function usePlayerFx({ view, me, status, effects, finished, winner }: {
  view: PlayerView
  me: string | null
  status: string
  effects: CardEffects
  finished: boolean
  winner: string | null
}) {
  const [pops, setPops] = useState<Pops>({})
  const [cracking, setCracking] = useState<Set<string>>(new Set())
  const [flights, setFlights] = useState<Flight[]>([])
  const [rolls, setRolls] = useState<RollFx[]>([])
  const [victory, setVictory] = useState<string | null>(null)
  const prev = useRef<PlayerView | null>(null)
  const key = useRef(0)
  const seenPlaying = useRef(false)
  const victoryTimer = useRef<ReturnType<typeof setTimeout>>()
  const effectsRef = useRef(effects)
  effectsRef.current = effects

  useEffect(() => {
    if (status !== 'open') {
      prev.current = null
      return
    }
    const before = prev.current
    prev.current = view
    const fx = effectsRef.current
    const { players, holders } = playerChanges(before, view)
    const now = Date.now()

    if (fx.life && players.length > 0) {
      setPops((current) => {
        const next = addPops(expirePops(current, now), players, now, key.current)
        key.current = next.key
        return next.pops
      })
      setTimeout(() => setPops((current) => expirePops(current, Date.now())), POP_MS + 50)
    }

    const eliminated = players.flatMap((c) => (c.kind === 'eliminated' ? [c.player] : []))
    if (fx.elimination && eliminated.length > 0) {
      setCracking((current) => new Set([...current, ...eliminated]))
      setTimeout(() => setCracking((current) => new Set([...current].filter((p) => !eliminated.includes(p)))), CRACK_MS)
    }

    if (fx.crowns && holders.length > 0) {
      const fresh = holders.map((h) => ({ ...h, key: ++key.current }))
      const keys = new Set(fresh.map((f) => f.key))
      setFlights((current) => [...current.filter((f) => !fresh.some((n) => n.kind === f.kind)), ...fresh])
      setTimeout(() => setFlights((current) => current.filter((f) => !keys.has(f.key))), FLIGHT_MS)
    }

    if (fx.dice && before) {
      // Lignes ajoutées au journal (même calcul que les repères d'activité), lancers seulement.
      const count = (view.logStart ?? 0) + view.log.length - ((before.logStart ?? 0) + before.log.length)
      const added = count > 0 ? view.log.slice(-Math.min(count, view.log.length)) : []
      const fresh = added.flatMap((l) => {
        const roll = l.roll ? parseRoll(l.text) : null
        if (!roll) return []
        const author = l.actor === me ? 'Vous' : (l.actor && view.players[l.actor]?.name) || ''
        return [{ key: ++key.current, author, ...roll }]
      })
      if (fresh.length > 0) {
        const keys = new Set(fresh.map((r) => r.key))
        setRolls((current) => [...current, ...fresh].slice(-MAX_ROLLS))
        setTimeout(() => setRolls((current) => current.filter((r) => !keys.has(r.key))), ROLL_SHOW_MS)
      }
    }
  }, [view, me, status])

  useEffect(() => {
    if (!finished) {
      if (status === 'open') seenPlaying.current = true
      return
    }
    if (!seenPlaying.current) return
    seenPlaying.current = false
    if (!winner || !effectsRef.current.elimination) return
    setVictory(winner)
    clearTimeout(victoryTimer.current)
    victoryTimer.current = setTimeout(() => setVictory(null), VICTORY_MS)
  }, [finished, winner, status])

  return { pops, cracking, flights, rolls, victory, dismissVictory: () => setVictory(null) }
}
