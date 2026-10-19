'use client'

import { useState } from 'react'
import {
  Anvil, ArrowUpToLine, Biohazard, BrickWall, Eye, EyeOff, Feather, Footprints, Hand, HeartPulse, Shield, ShieldCheck, Skull, Sword, Swords, Users, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  abilityText, COLORS, isValidParam, KEYWORDS, keywordLabel, PROTECTION_ALL, takesParam,
  type AbilityChoice, type Color, type GainedAbility, type Keyword,
} from '@/lib/game/abilities'
import type { VisibleCard } from '@/lib/game/types'
import type { AbilityStyle } from '@/lib/table-settings'

const ICONS: Record<Keyword, LucideIcon> = {
  Flying: Feather, Deathtouch: Skull, Lifelink: HeartPulse, Trample: Footprints, Vigilance: Eye, Haste: Zap,
  'First strike': Sword, 'Double strike': Swords, Hexproof: ShieldCheck, Shroud: EyeOff, Indestructible: Anvil,
  Menace: Users, Reach: ArrowUpToLine, Defender: BrickWall, Infect: Biohazard, Protection: Shield, Ward: Hand,
}

/** Pastilles des couleurs de Protection (couleurs du mana). */
const COLOR_DOTS: Record<Color, string> = { W: '#f8f3d8', U: '#3b82f6', B: '#4b4453', R: '#e05252', G: '#4ade80' }
const COLOR_NAMES: Record<Color, string> = { W: 'blanc', U: 'bleu', B: 'noir', R: 'rouge', G: 'vert' }
/** Raccourcis du coût d'une Parade. */
const WARD_COSTS = ['{1}', '{2}', '{3}', '{4}']
const DEFAULT_WARD = '{2}'

type Badge = { keyword: Keyword; param?: string; state: 'gained' | 'eot' | 'lost' }

/** Couleurs d'une Protection (« all » : aucune, c'est « contre tout »). */
const colorsOf = (param: string | undefined): Color[] => (param && param !== PROTECTION_ALL ? (param.split(',') as Color[]) : [])

/** Précision dans une pastille : points de couleur, « ∞ » pour tout, ou le coût d'une Parade (« 2 »). */
function ParamMark({ keyword, param }: { keyword: Keyword; param: string }) {
  if (keyword === 'Protection') {
    if (param === PROTECTION_ALL) return <span className="text-[10px] leading-none">∞</span>
    return (
      <span className="flex gap-px">
        {colorsOf(param).map((c) => <span key={c} className="w-1.5 h-1.5 rounded-full border border-black/40" style={{ background: COLOR_DOTS[c] }} />)}
      </span>
    )
  }
  // Coût court ({2}, {X}) : la valeur seule ; un coût long (« — Payez 3 points de vie ») reste au survol et dans l'aperçu.
  const short = /^\{[^}]{1,2}\}$/.exec(param.trim())
  return short ? <span className="text-[9px] leading-none font-bold text-white">{param.trim().slice(1, -1)}</span> : null
}

/**
 * Capacités données (sauf le vol, qui a son animation) et capacités imprimées perdues d'une carte en jeu : symboles
 * sur le bord gauche, ou libellés au milieu, selon le réglage. Champs absents (serveur de jeu plus ancien) : rien.
 */
export function AbilityBadges({ card, style }: { card: VisibleCard; style: AbilityStyle }) {
  const badges: Badge[] = [
    ...(card.gained ?? []).filter((g) => g.keyword !== 'Flying')
      .map((g): Badge => ({ keyword: g.keyword, param: g.param, state: g.untilEndOfTurn ? 'eot' : 'gained' })),
    ...(card.lost ?? []).map((keyword): Badge => ({ keyword, state: 'lost' })),
  ]
  if (badges.length === 0) return null
  const icons = style === 'icons'
  return (
    <div className={`absolute pointer-events-none z-[1] flex flex-col gap-0.5 ${icons ? '-left-1.5 top-[18%] items-start' : 'inset-x-0 top-[30%] items-center'}`} data-abilities={style}>
      {badges.map(({ keyword, param, state }) => {
        const Icon = ICONS[keyword]
        const text = abilityText({ keyword, param })
        const title = state === 'lost' ? `${text} (perdue)` : state === 'eot' ? `${text} (jusqu’à la fin du tour)` : text
        const color = state === 'lost' ? 'border-dc-red-light text-dc-red-light' : 'border-dc-gold text-dc-gold-light'
        const border = state === 'eot' ? 'border-dashed' : 'border-solid'
        // Protection : ses couleurs en pastilles (toujours visibles, même si le libellé est coupé) ; Parade : son coût écrit.
        const label = param && keyword === 'Ward' ? `${keywordLabel(keyword)} ${param}` : keywordLabel(keyword)
        return icons ? (
          <span key={`${state}-${keyword}`} title={title} data-ability={keyword} data-ability-state={state} data-ability-param={param}
            className={`relative h-5 min-w-5 px-[3px] rounded-full bg-[#0d0d14] border flex items-center justify-center gap-0.5 ${color} ${border}`}>
            <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
            {param && <ParamMark keyword={keyword} param={param} />}
            {state === 'lost' && <span className="absolute w-6 h-0.5 bg-dc-red-light -rotate-45" aria-hidden="true" />}
            <span className="sr-only">{title}</span>
          </span>
        ) : (
          <span key={`${state}-${keyword}`} title={title} data-ability={keyword} data-ability-state={state} data-ability-param={param}
            className={`max-w-[94%] inline-flex items-center gap-0.5 px-1 rounded bg-black/80 border text-[9px] leading-tight font-semibold ${color} ${border}`}>
            <Icon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            {param && keyword === 'Protection' && <span className="shrink-0"><ParamMark keyword={keyword} param={param} /></span>}
            {/* Petite carte : un nom trop long est coupé (« Défense talism… ») ; il est entier au survol et dans l'aperçu. */}
            <span className={`min-w-0 truncate text-white ${state === 'lost' ? 'line-through' : ''}`}>{label}</span>
          </span>
        )
      })}
    </div>
  )
}

/** Choix des couleurs d'une Protection : pastilles W U B R G, ou « Tout ». */
function ProtectionChoice({ value, onChange }: { value: string; onChange: (param: string) => void }) {
  const colors = colorsOf(value)
  const toggle = (c: Color) => {
    const next = colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c]
    onChange(COLORS.filter((x) => next.includes(x)).join(','))
  }
  const chip = 'h-7 min-w-7 px-2 rounded-full border text-xs flex items-center justify-center gap-1 tablet:h-9 tablet:min-w-9'
  return (
    <div className="flex flex-wrap gap-1.5 pl-7 pb-1" role="group" aria-label="Protection contre">
      {COLORS.map((c) => (
        <button key={c} type="button" aria-pressed={colors.includes(c)} onClick={() => toggle(c)} title={COLOR_NAMES[c]}
          className={`${chip} ${colors.includes(c) ? 'border-dc-gold bg-dc-gold/20 text-dc-text' : 'border-dc-border text-dc-muted'}`}>
          <span className="w-3 h-3 rounded-full border border-black/40" style={{ background: COLOR_DOTS[c] }} />
          {COLOR_NAMES[c]}
        </button>
      ))}
      <button type="button" aria-pressed={value === PROTECTION_ALL} onClick={() => onChange(value === PROTECTION_ALL ? '' : PROTECTION_ALL)}
        className={`${chip} ${value === PROTECTION_ALL ? 'border-dc-gold bg-dc-gold/20 text-dc-text' : 'border-dc-border text-dc-muted'}`}>
        Tout
      </button>
    </div>
  )
}

/** Coût d'une Parade : champ libre et raccourcis {1} à {4}. */
function WardChoice({ value, onChange }: { value: string; onChange: (param: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-7 pb-1">
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={40} aria-label="Coût de la Parade"
        className="w-40 bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm text-dc-text" placeholder="{2}" />
      {WARD_COSTS.map((cost) => (
        <button key={cost} type="button" onClick={() => onChange(cost)}
          className={`h-7 px-2 rounded border text-xs tablet:h-9 ${value === cost ? 'border-dc-gold bg-dc-gold/20 text-dc-text' : 'border-dc-border text-dc-muted'}`}>
          {cost}
        </button>
      ))}
    </div>
  )
}

/**
 * Fenêtre « Capacités » (« Donner une capacité… ») : une case par capacité, cochée si la carte l'a déjà. Décocher une
 * capacité imprimée la marque perdue ; la durée choisie vaut pour les capacités ajoutées. Protection et Parade
 * demandent leur précision (couleurs, coût) avant de pouvoir valider.
 */
export function AbilitiesModal({ name, printed, gained, lost, onValidate, onClose }: {
  name: string
  /** Capacités imprimées de la face montrée (aucune pour une carte face cachée). */
  printed: string[]
  gained: GainedAbility[]
  lost: Keyword[]
  onValidate: (gained: AbilityChoice[], lost: Keyword[], untilEndOfTurn: boolean) => void
  onClose: () => void
}) {
  const isPrinted = (k: Keyword) => printed.includes(k)
  const [checked, setChecked] = useState<Set<Keyword>>(
    () => new Set(KEYWORDS.filter((k) => gained.some((g) => g.keyword === k) || (isPrinted(k) && !lost.includes(k)))),
  )
  const [params, setParams] = useState<Partial<Record<Keyword, string>>>(() => ({
    Protection: gained.find((g) => g.keyword === 'Protection')?.param ?? '',
    Ward: gained.find((g) => g.keyword === 'Ward')?.param ?? DEFAULT_WARD,
  }))
  const [untilEndOfTurn, setUntilEndOfTurn] = useState(false)
  const toggle = (k: Keyword) => setChecked((s) => {
    const next = new Set(s)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    return next
  })
  const note = (k: Keyword) => (isPrinted(k) ? ' (imprimée)' : gained.find((g) => g.keyword === k)?.untilEndOfTurn ? ' (ce tour)' : '')
  /** Capacité cochée qui demande sa précision (pas pour une imprimée : elle est déjà sur la carte). */
  const needsParam = (k: Keyword) => takesParam(k) && checked.has(k) && !isPrinted(k)
  const paramOf = (k: Keyword) => (k === 'Ward' ? (params.Ward ?? '').trim() : params[k] ?? '')
  const lacking = KEYWORDS.filter((k) => needsParam(k) && !isValidParam(k, paramOf(k)))
  const missing = lacking.length > 0
  const missingText = lacking.map((k) => (k === 'Protection' ? 'les couleurs de la Protection' : 'le coût de la Parade')).join(' et ')

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="bg-dc-surface border border-dc-gold/60 rounded-2xl w-full max-w-md max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Capacités : ${name}`}
        onSubmit={(e) => {
          e.preventDefault()
          if (missing) return
          onValidate(
            KEYWORDS.filter((k) => !isPrinted(k) && checked.has(k)).map((k): AbilityChoice => (takesParam(k) ? { keyword: k, param: paramOf(k) } : k)),
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
              <div key={k} className={needsParam(k) ? 'sm:col-span-2' : ''}>
                <label className="flex items-center gap-2 px-1 py-1.5 rounded text-sm text-dc-text hover:bg-dc-border/60 cursor-pointer tablet:py-2.5">
                  <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} />
                  <Icon className="w-4 h-4 text-dc-gold-light shrink-0" aria-hidden="true" />
                  <span>{keywordLabel(k)}{note(k) && <span className="text-dc-muted text-xs">{note(k)}</span>}</span>
                </label>
                {needsParam(k) && k === 'Protection' && (
                  <ProtectionChoice value={params.Protection ?? ''} onChange={(param) => setParams((p) => ({ ...p, Protection: param }))} />
                )}
                {needsParam(k) && k === 'Ward' && (
                  <WardChoice value={params.Ward ?? ''} onChange={(param) => setParams((p) => ({ ...p, Ward: param }))} />
                )}
              </div>
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
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          {missing && <span className="mr-auto text-xs text-dc-red-light" role="status">Choisis {missingText}.</span>}
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-dc-border text-sm text-dc-text">Annuler</button>
          <button type="submit" disabled={missing} className="px-3 py-1.5 rounded-lg bg-dc-gold text-black text-sm font-semibold disabled:opacity-40">Valider</button>
        </div>
      </form>
    </div>
  )
}
