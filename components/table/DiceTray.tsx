'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ROLL_MS, type RollFx } from './usePlayerFx'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Contour de chaque dé (sauf le d6, en cube, et la pièce), dans un carré de 100. */
const SHAPES: Record<number, string> = {
  4: '50,6 96,90 4,90',
  8: '50,2 96,50 50,98 4,50',
  10: '50,2 94,40 50,98 6,40',
  12: '50,3 96,37 78,94 22,94 4,37',
  20: '50,2 93,26 93,74 50,98 7,74 7,26',
}

/** Rotation qui montre chaque face du cube vers l'avant. */
const CUBE_FACES: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(0deg) rotateY(-180deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  6: 'rotateX(90deg) rotateY(0deg)',
}
const CUBE_PLACES: Record<number, string> = {
  1: 'rotateY(0deg)',
  2: 'rotateY(90deg)',
  3: 'rotateY(180deg)',
  4: 'rotateY(-90deg)',
  5: 'rotateX(90deg)',
  6: 'rotateX(-90deg)',
}

/** d6 : un cube en 3D qui roule et s'arrête sur la face du résultat. */
function Cube({ result, still }: { result: number; still: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (still || !ref.current) return
    const spin = `rotateX(${720 + 90 * Math.floor(Math.random() * 4)}deg) rotateY(${540 + 90 * Math.floor(Math.random() * 4)}deg)`
    const animation = ref.current.animate([{ transform: spin }, { transform: CUBE_FACES[result] }],
      { duration: ROLL_MS, easing: 'cubic-bezier(0.2, 0.75, 0.3, 1)' })
    return () => animation.cancel()
  }, [result, still])
  return (
    <div className="w-12 h-12 [perspective:300px]">
      <div ref={ref} className="relative w-full h-full [transform-style:preserve-3d]" style={{ transform: CUBE_FACES[result] }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="absolute inset-0 rounded-lg border-2 border-dc-gold bg-dc-surface text-dc-gold font-bold text-xl flex items-center justify-center [backface-visibility:hidden]"
            style={{ transform: `${CUBE_PLACES[n]} translateZ(24px)` }}>{n}</div>
        ))}
      </div>
    </div>
  )
}

/** Pièce : elle tourne sur elle-même et retombe sur « Pile » ou « Face ». */
function Coin({ result, still }: { result: number; still: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const end = result === 1 ? 'rotateY(0deg)' : 'rotateY(180deg)'
  useLayoutEffect(() => {
    if (still || !ref.current) return
    const animation = ref.current.animate([{ transform: `translateY(0) rotateY(0deg)` }, { transform: `translateY(-40px) rotateY(900deg)`, offset: 0.5 },
      { transform: `translateY(0) rotateY(${result === 1 ? 1800 : 1980}deg)` }], { duration: ROLL_MS, easing: 'ease-out' })
    return () => animation.cancel()
  }, [result, still])
  const face = 'absolute inset-0 rounded-full border-2 border-dc-gold bg-dc-gold/20 text-dc-gold text-[11px] font-bold flex items-center justify-center [backface-visibility:hidden]'
  return (
    <div className="w-14 h-14 [perspective:300px]">
      <div ref={ref} className="relative w-full h-full [transform-style:preserve-3d]" style={{ transform: end }}>
        <div className={face}>Pile</div>
        <div className={face} style={{ transform: 'rotateY(180deg)' }}>Face</div>
      </div>
    </div>
  )
}

/** Autres dés : leur forme roule en faisant défiler des nombres, puis se pose sur le résultat. */
function FlatDie({ sides, result, still }: { sides: number; result: number; still: boolean }) {
  const [shown, setShown] = useState(still ? result : 1 + Math.floor(Math.random() * sides))
  useEffect(() => {
    if (still) return setShown(result)
    const tick = setInterval(() => setShown(1 + Math.floor(Math.random() * sides)), 70)
    const stop = setTimeout(() => {
      clearInterval(tick)
      setShown(result)
    }, ROLL_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
  }, [sides, result, still])
  return (
    <div className={`relative w-12 h-12 ${still ? '' : 'fx-die-tumble'}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden>
        <polygon points={SHAPES[sides]} fill="rgba(201,168,76,0.18)" stroke="#c9a84c" strokeWidth="5" strokeLinejoin="round" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-bold text-dc-gold tabular-nums ${sides === 4 ? 'pt-3 text-sm' : 'text-base'}`}>{shown}</span>
    </div>
  )
}

function Die({ sides, result, still }: { sides: number; result: number; still: boolean }) {
  if (sides === 6) return <Cube result={result} still={still} />
  if (sides === 2) return <Coin result={result} still={still} />
  return <FlatDie sides={sides} result={result} still={still} />
}

/**
 * Plateaux de dés au milieu de la table : un par lancer récent, avec son auteur ; le dé roule puis montre son résultat
 * (résultats lus dans la ligne du journal). Mouvement réduit : directement le résultat, immobile.
 */
export default function DiceTray({ rolls }: { rolls: RollFx[] }) {
  if (rolls.length === 0) return null
  const still = reducedMotion()
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-[44] flex flex-col items-center gap-2" data-testid="dice-tray">
      {rolls.map((roll) => (
        <div key={roll.key} className="fx-tray flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl bg-dc-surface/90 border border-dc-gold/60 shadow-card"
          data-fx-roll={`d${roll.sides}`} data-results={roll.results.join(',')}>
          {roll.author && <span className="text-xs text-dc-gold font-semibold">{roll.author}</span>}
          <div className="flex flex-wrap justify-center gap-2 max-w-[22rem]">
            {roll.results.map((r, i) => <Die key={i} sides={roll.sides} result={r} still={still} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
