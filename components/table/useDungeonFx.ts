'use client'

import { useEffect, useState } from 'react'
import { dungeonFx, type DungeonFx } from '@/lib/game/dungeon-fx'
import type { DungeonPosition } from '@/lib/game/dungeons'

/** Durée d'une animation de donjon (glissement, salle qui s'allume, éclat). */
export const DUNGEON_FX_MS = 1800

/**
 * Animation à jouer quand le jeton du joueur change de salle sous nos yeux ; jamais au premier affichage.
 * Calculée pendant le rendu (état dérivé) : la classe de glissement est posée en même temps que la nouvelle place.
 */
export function useDungeonFx(position: DungeonPosition | undefined, done: number, enabled: boolean): (DungeonFx & { n: number }) | null {
  const key = `${position?.id}:${position?.room}:${done}`
  const [seen, setSeen] = useState({ key, position, done })
  const [fx, setFx] = useState<(DungeonFx & { n: number }) | null>(null)
  if (seen.key !== key) {
    setSeen({ key, position, done })
    const next = enabled ? dungeonFx(seen, { position, done }) : null
    setFx(next && { ...next, n: (fx?.n ?? 0) + 1 })
  }
  useEffect(() => {
    if (!fx) return
    const timer = setTimeout(() => setFx(null), DUNGEON_FX_MS)
    return () => clearTimeout(timer)
  }, [fx])
  return enabled ? fx : null
}
