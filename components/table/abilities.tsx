'use client'

import { useState } from 'react'
import {
  Anvil, ArrowUpToLine, Biohazard, BrickWall, Eye, EyeOff, Feather, Footprints, HeartPulse, ShieldCheck, Skull, Sword, Swords, Users, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import { KEYWORDS, keywordLabel, type GainedAbility, type Keyword } from '@/lib/game/abilities'
import type { VisibleCard } from '@/lib/game/types'
import type { AbilityStyle } from '@/lib/table-settings'

const ICONS: Record<Keyword, LucideIcon> = {
  Flying: Feather, Deathtouch: Skull, Lifelink: HeartPulse, Trample: Footprints, Vigilance: Eye, Haste: Zap,
  'First strike': Sword, 'Double strike': Swords, Hexproof: ShieldCheck, Shroud: EyeOff, Indestructible: Anvil,
  Menace: Users, Reach: ArrowUpToLine, Defender: BrickWall, Infect: Biohazard,
}

type Badge = { keyword: Keyword; state: 'gained' | 'eot' | 'lost' }

/**
 * Capacités données (sauf le vol, qui a son animation) et capacités imprimées perdues d'une carte en jeu : symboles
 * sur le bord gauche, ou libellés au milieu, selon le réglage. Champs absents (serveur de jeu plus ancien) : rien.
 */
export function AbilityBadges({ card, style }: { card: VisibleCard; style: AbilityStyle }) {
  const badges: Badge[] = [
    ...(card.gained ?? []).filter((g) => g.keyword !== 'Flying').map((g): Badge => ({ keyword: g.keyword, state: g.untilEndOfTurn ? 'eot' : 'gained' })),
    ...(card.lost ?? []).map((keyword): Badge => ({ keyword, state: 'lost' })),
  ]
  if (badges.length === 0) return null
  const icons = style === 'icons'
  return (
    <div className={`absolute pointer-events-none z-[1] flex flex-col gap-0.5 ${icons ? '-left-1.5 top-[18%]' : 'inset-x-0 top-[30%] items-center'}`} data-abilities={style}>
      {badges.map(({ keyword, state }) => {
        const Icon = ICONS[keyword]
        const label = keywordLabel(keyword)
        const title = state === 'lost' ? `${label} (perdue)` : state === 'eot' ? `${label} (jusqu’à la fin du tour)` : label
        const color = state === 'lost' ? 'border-dc-red-light text-dc-red-light' : 'border-dc-gold text-dc-gold-light'
        const border = state === 'eot' ? 'border-dashed' : 'border-solid'
        return icons ? (
          <span key={`${state}-${keyword}`} title={title} data-ability={keyword} data-ability-state={state}
            className={`relative w-5 h-5 rounded-full bg-[#0d0d14] border flex items-center justify-center ${color} ${border}`}>
            <Icon className="w-3 h-3" aria-hidden="true" />
            {state === 'lost' && <span className="absolute w-6 h-0.5 bg-dc-red-light -rotate-45" aria-hidden="true" />}
            <span className="sr-only">{title}</span>
          </span>
        ) : (
          <span key={`${state}-${keyword}`} title={title} data-ability={keyword} data-ability-state={state}
            className={`max-w-[94%] inline-flex items-center gap-0.5 px-1 rounded bg-black/80 border text-[9px] leading-tight font-semibold ${color} ${border}`}>
            <Icon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            {/* Petite carte : un nom trop long est coupé (« Défense talism… ») ; il est entier au survol et dans l'aperçu. */}
            <span className={`min-w-0 truncate text-white ${state === 'lost' ? 'line-through' : ''}`}>{label}</span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * Fenêtre « Capacités » (« Donner une capacité… ») : une case par capacité, cochée si la carte l'a déjà. Décocher une
 * capacité imprimée la marque perdue ; la durée choisie vaut pour les capacités ajoutées.
 */
export function AbilitiesModal({ name, printed, gained, lost, onValidate, onClose }: {
  name: string
  /** Capacités imprimées de la face montrée (aucune pour une carte face cachée). */
  printed: string[]
  gained: GainedAbility[]
  lost: Keyword[]
  onValidate: (gained: Keyword[], lost: Keyword[], untilEndOfTurn: boolean) => void
  onClose: () => void
}) {
  const isPrinted = (k: Keyword) => printed.includes(k)
  const [checked, setChecked] = useState<Set<Keyword>>(
    () => new Set(KEYWORDS.filter((k) => gained.some((g) => g.keyword === k) || (isPrinted(k) && !lost.includes(k)))),
  )
  const [untilEndOfTurn, setUntilEndOfTurn] = useState(false)
  const toggle = (k: Keyword) => setChecked((s) => {
    const next = new Set(s)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    return next
  })
  const note = (k: Keyword) => (isPrinted(k) ? ' (imprimée)' : gained.find((g) => g.keyword === k)?.untilEndOfTurn ? ' (ce tour)' : '')

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="bg-dc-surface border border-dc-gold/60 rounded-2xl w-full max-w-md max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Capacités : ${name}`}
        onSubmit={(e) => {
          e.preventDefault()
          onValidate(
            KEYWORDS.filter((k) => !isPrinted(k) && checked.has(k)),
            KEYWORDS.filter((k) => isPrinted(k) && !checked.has(k)),
            untilEndOfTurn,
          )
          onClose()
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold text-sm truncate">Capacités : {name}</h2>
          <button type="button" onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          {KEYWORDS.map((k) => {
            const Icon = ICONS[k]
            return (
              <label key={k} className="flex items-center gap-2 px-1 py-1.5 rounded text-sm text-dc-text hover:bg-dc-border/60 cursor-pointer tablet:py-2.5">
                <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} />
                <Icon className="w-4 h-4 text-dc-gold-light shrink-0" aria-hidden="true" />
                <span>{keywordLabel(k)}{note(k) && <span className="text-dc-muted text-xs">{note(k)}</span>}</span>
              </label>
            )
          })}
        </div>
        <fieldset className="mx-3 mb-3 px-3 pb-2 border border-dc-border rounded-lg flex flex-wrap gap-x-4 gap-y-1 text-sm text-dc-text">
          <legend className="px-1 text-xs text-dc-muted">Durée des capacités ajoutées</legend>
          <label className="flex items-center gap-1.5 cursor-pointer tablet:py-1.5">
            <input type="radio" name="duree" checked={!untilEndOfTurn} onChange={() => setUntilEndOfTurn(false)} /> Tout le temps
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer tablet:py-1.5">
            <input type="radio" name="duree" checked={untilEndOfTurn} onChange={() => setUntilEndOfTurn(true)} /> Jusqu’à la fin du tour
          </label>
        </fieldset>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-dc-border text-sm text-dc-text">Annuler</button>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-dc-gold text-black text-sm font-semibold">Valider</button>
        </div>
      </form>
    </div>
  )
}
