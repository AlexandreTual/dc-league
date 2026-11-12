'use client'

import { useState } from 'react'
import {
  Angry, Minus, Plus, Anvil, ArrowUpToLine, Award, Axe, Biohazard, Bomb, BrickWall, ChevronsUp, Copy, Crown, Droplet, Dumbbell, Eye, EyeOff, Feather,
  FlaskConical, Footprints, Frown, Ghost, GraduationCap, Hand, HeartCrack, HeartPulse, Info, Magnet, Megaphone, Moon, Mountain, RefreshCw, RotateCcw,
  Shield, ShieldCheck, Skull, Sparkles, Sun, Sword, Swords, Syringe, TreePine, Users, VenetianMask, Waves, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  abilityName, abilityRule, COLORS, isNumbered, isValidParam, KEYWORD_GROUPS, KEYWORDS, keywordLabel, PROTECTION_ALL, takesParam,
  type AbilityChoice, type Color, type GainedAbility, type Keyword,
} from '@/lib/game/abilities'
import { MAX_PT_MOD } from '@/lib/game/pt'
import type { PtMod, VisibleCard } from '@/lib/game/types'
import type { AbilityStyle } from '@/lib/table-settings'
import { useT } from '@/components/i18n/I18nProvider'

const ICONS: Record<Keyword, LucideIcon> = {
  Flying: Feather, Deathtouch: Skull, Lifelink: HeartPulse, Trample: Footprints, Vigilance: Eye, Haste: Zap,
  'First strike': Sword, 'Double strike': Swords, Hexproof: ShieldCheck, Shroud: EyeOff, Indestructible: Anvil,
  Menace: Users, Reach: ArrowUpToLine, Defender: BrickWall, Infect: Biohazard, Protection: Shield, Ward: Hand,
  Fear: Frown, Intimidate: Angry, Shadow: Moon, Skulk: VenetianMask, Plainswalk: Sun, Islandwalk: Waves, Swampwalk: Droplet,
  Mountainwalk: Mountain, Forestwalk: TreePine, Prowess: Sparkles, Exalted: Crown, Wither: FlaskConical, 'Battle cry': Megaphone,
  Myriad: Copy, Melee: Axe, Dethrone: ChevronsUp, Mentor: GraduationCap, Training: Dumbbell, Persist: RotateCcw, Undying: RefreshCw,
  Annihilator: Bomb, Toxic: Syringe, Afflict: HeartCrack, Bushido: Award, Afterlife: Ghost, Absorb: Magnet,
}

/** Pastilles des couleurs de Protection (couleurs du mana). */
const COLOR_DOTS: Record<Color, string> = { W: '#f8f3d8', U: '#3b82f6', B: '#4b4453', R: '#e05252', G: '#4ade80' }
/** Raccourcis du coût d'une Parade. */
const WARD_COSTS = ['{1}', '{2}', '{3}', '{4}']
const DEFAULT_WARD = '{2}'
/** Raccourcis et valeur proposée d'une capacité chiffrée (Annihilateur 2, Toxique 1…). */
const NUMBERS = ['1', '2', '3', '4']
const defaultNumber = (k: Keyword) => (k === 'Annihilator' || k === 'Afflict' ? '2' : '1')

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
  if (isNumbered(keyword)) return <span className="text-[9px] leading-none font-bold text-white">{param}</span>
  // Coût court ({2}, {X}) : la valeur seule ; un coût long (« — Payez 3 points de vie ») reste au survol et dans l'aperçu.
  const short = /^\{[^}]{1,2}\}$/.exec(param.trim())
  return short ? <span className="text-[9px] leading-none font-bold text-white">{param.trim().slice(1, -1)}</span> : null
}

/**
 * Capacités données (sauf le vol, qui a son animation) et capacités imprimées perdues d'une carte en jeu : symboles
 * sur le bord gauche, ou libellés au milieu, selon le réglage. Champs absents (serveur de jeu plus ancien) : rien.
 */
export function AbilityBadges({ card, style }: { card: VisibleCard; style: AbilityStyle }) {
  const t = useT()
  const a = t.table.abilities
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
        const text = abilityName({ keyword, param }, t)
        const status = state === 'lost' ? a.lostStatus(text) : state === 'eot' ? a.eotStatus(text) : text
        // Au survol : la capacité, puis son texte des règles.
        const title = `${status}\n${abilityRule(keyword, t, param)}`
        const color = state === 'lost' ? 'border-dc-red-light text-dc-red-light' : 'border-dc-gold text-dc-gold-light'
        const border = state === 'eot' ? 'border-dashed' : 'border-solid'
        // Protection : ses couleurs en pastilles (toujours visibles, même si le libellé est coupé) ; Parade, Annihilateur… : coût ou nombre écrit.
        const label = param && keyword !== 'Protection' ? `${keywordLabel(keyword, t)} ${param}` : keywordLabel(keyword, t)
        return icons ? (
          <span key={`${state}-${keyword}`} title={title} data-ability={keyword} data-ability-state={state} data-ability-param={param}
            className={`relative h-5 min-w-5 px-[3px] rounded-full bg-[#0d0d14] border flex items-center justify-center gap-0.5 ${color} ${border}`}>
            <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
            {param && <ParamMark keyword={keyword} param={param} />}
            {state === 'lost' && <span className="absolute w-6 h-0.5 bg-dc-red-light -rotate-45" aria-hidden="true" />}
            <span className="sr-only">{status}</span>
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
  const a = useT().table.abilities
  const colors = colorsOf(value)
  const toggle = (c: Color) => {
    const next = colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c]
    onChange(COLORS.filter((x) => next.includes(x)).join(','))
  }
  const chip = 'h-7 min-w-7 px-2 rounded-full border text-xs flex items-center justify-center gap-1 tablet:h-9 tablet:min-w-9'
  return (
    <div className="flex flex-wrap gap-1.5 pl-7 pb-1" role="group" aria-label={a.protectionGroup}>
      {COLORS.map((c) => (
        <button key={c} type="button" aria-pressed={colors.includes(c)} onClick={() => toggle(c)} title={a.colorAdjectives[c]}
          className={`${chip} ${colors.includes(c) ? 'border-dc-gold bg-dc-gold/20 text-dc-text' : 'border-dc-border text-dc-muted'}`}>
          <span className="w-3 h-3 rounded-full border border-black/40" style={{ background: COLOR_DOTS[c] }} />
          {a.colorAdjectives[c]}
        </button>
      ))}
      <button type="button" aria-pressed={value === PROTECTION_ALL} onClick={() => onChange(value === PROTECTION_ALL ? '' : PROTECTION_ALL)}
        className={`${chip} ${value === PROTECTION_ALL ? 'border-dc-gold bg-dc-gold/20 text-dc-text' : 'border-dc-border text-dc-muted'}`}>
        {a.all}
      </button>
    </div>
  )
}

/** Coût d'une Parade : champ libre et raccourcis {1} à {4}. */
function WardChoice({ value, onChange }: { value: string; onChange: (param: string) => void }) {
  const a = useT().table.abilities
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-7 pb-1">
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={40} aria-label={a.wardCost}
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

/** Nombre d'une capacité chiffrée : champ et raccourcis 1 à 4. */
function NumberChoice({ keyword, value, onChange }: { keyword: Keyword; value: string; onChange: (param: string) => void }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-7 pb-1">
      <input value={value} onChange={(e) => onChange(e.target.value.trim())} maxLength={2} inputMode="numeric" aria-label={t.table.abilities.valueOf(keywordLabel(keyword, t))}
        className="w-14 bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm text-dc-text" placeholder="1" />
      {NUMBERS.map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`h-7 min-w-7 px-2 rounded border text-xs tablet:h-9 tablet:min-w-9 ${value === n ? 'border-dc-gold bg-dc-gold/20 text-dc-text' : 'border-dc-border text-dc-muted'}`}>
          {n}
        </button>
      ))}
    </div>
  )
}

/** Écart de force ou d'endurance d'un effet : − / +, et saisie directe (signe accepté). */
function PtField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const n = Number.parseInt(value, 10) || 0
  const step = (d: number) => onChange(String(Math.max(-MAX_PT_MOD, Math.min(MAX_PT_MOD, n + d))))
  const button = 'w-8 h-8 rounded-lg border border-dc-border flex items-center justify-center text-dc-text hover:border-dc-gold/60 tablet:w-11 tablet:h-11'
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-20 text-sm text-dc-text">{label}</span>
      <button type="button" className={button} onClick={() => step(-1)} aria-label={`${label} −1`}><Minus className="w-4 h-4" /></button>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9+-]/g, '').slice(0, 5))} inputMode="numeric" aria-label={label}
        className="w-16 bg-dc-bg border border-dc-border rounded px-2 py-1 text-center text-sm text-dc-text tablet:py-2.5" />
      <button type="button" className={button} onClick={() => step(1)} aria-label={`${label} +1`}><Plus className="w-4 h-4" /></button>
    </div>
  )
}

/** Écart tapé, borné ; 0 pour une saisie vide ou incomplète (« - »). */
const ptValue = (value: string) => Math.max(-MAX_PT_MOD, Math.min(MAX_PT_MOD, Number.parseInt(value, 10) || 0))

/**
 * Fenêtre « Capacités » (« Donner une capacité… ») : une case par capacité, cochée si la carte l'a déjà. Décocher une
 * capacité imprimée la marque perdue ; la durée choisie vaut pour les capacités ajoutées. Protection, Parade et les
 * capacités chiffrées demandent leur précision (couleurs, coût, nombre) avant de pouvoir valider. Le bouton « i » de
 * chaque ligne déplie le texte des règles de la capacité.
 * `effect` : fenêtre « Effet » sur plusieurs permanents (Finale of Devastation…) : écart de force et d'endurance en
 * plus des capacités (aucune cochée au départ, rien de retiré), durée « Jusqu'à la fin du tour » par défaut.
 */
export function AbilitiesModal({ name, printed, gained, lost, effect = false, onValidate, onClose }: {
  name: string
  /** Capacités imprimées de la face montrée (aucune pour une carte face cachée). */
  printed: string[]
  gained: GainedAbility[]
  lost: Keyword[]
  effect?: boolean
  onValidate: (gained: AbilityChoice[], lost: Keyword[], untilEndOfTurn: boolean, pt: PtMod) => void
  onClose: () => void
}) {
  const t = useT()
  const a = t.table.abilities
  const [power, setPower] = useState('0')
  const [toughness, setToughness] = useState('0')
  const isPrinted = (k: Keyword) => printed.includes(k)
  const [checked, setChecked] = useState<Set<Keyword>>(
    () => new Set(KEYWORDS.filter((k) => gained.some((g) => g.keyword === k) || (isPrinted(k) && !lost.includes(k)))),
  )
  const [params, setParams] = useState<Partial<Record<Keyword, string>>>(() => Object.fromEntries(KEYWORDS.filter(takesParam).map((k) => [
    k, gained.find((g) => g.keyword === k)?.param ?? (k === 'Protection' ? '' : k === 'Ward' ? DEFAULT_WARD : defaultNumber(k)),
  ])))
  const setParam = (k: Keyword) => (param: string) => setParams((p) => ({ ...p, [k]: param }))
  const [untilEndOfTurn, setUntilEndOfTurn] = useState(effect)
  /** Capacité dont le texte des règles est déplié (une à la fois). */
  const [ruleOpen, setRuleOpen] = useState<Keyword | null>(null)
  const toggle = (k: Keyword) => setChecked((s) => {
    const next = new Set(s)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    return next
  })
  const note = (k: Keyword) => (isPrinted(k) ? a.printedNote : gained.find((g) => g.keyword === k)?.untilEndOfTurn ? a.thisTurn : '')
  /** Capacité cochée qui demande sa précision (pas pour une imprimée : elle est déjà sur la carte). */
  const needsParam = (k: Keyword) => takesParam(k) && checked.has(k) && !isPrinted(k)
  const paramOf = (k: Keyword) => (k === 'Ward' ? (params.Ward ?? '').trim() : params[k] ?? '')
  const lacking = KEYWORDS.filter((k) => needsParam(k) && !isValidParam(k, paramOf(k)))
  const missing = lacking.length > 0
  const pt = { power: ptValue(power), toughness: ptValue(toughness) }
  // Un effet sans écart ni capacité ne ferait rien.
  const empty = effect && pt.power === 0 && pt.toughness === 0 && checked.size === 0
  const heading = effect ? a.effectHeading(name) : a.heading(name)
  const missingText = a.list(lacking.map((k) => (
    k === 'Protection' ? a.missingProtection : k === 'Ward' ? a.missingWard : a.missingValue(keywordLabel(k, t))
  )))

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="bg-dc-surface border border-dc-gold/60 rounded-2xl w-full max-w-md max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={heading}
        onSubmit={(e) => {
          e.preventDefault()
          if (missing || empty) return
          onValidate(
            KEYWORDS.filter((k) => !isPrinted(k) && checked.has(k)).map((k): AbilityChoice => (takesParam(k) ? { keyword: k, param: paramOf(k) } : k)),
            KEYWORDS.filter((k) => isPrinted(k) && !checked.has(k)),
            untilEndOfTurn,
            pt,
          )
          onClose()
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold text-sm truncate">{heading}</h2>
          <button type="button" onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label={t.common.close}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          {effect && (
            <div className="sm:col-span-2 pb-2 mb-1 border-b border-dc-border flex flex-col gap-1.5" data-testid="effect-pt">
              <h3 className="px-1 text-xs uppercase tracking-wide text-dc-muted">{a.ptHeading}</h3>
              <PtField label={a.power} value={power} onChange={setPower} />
              <PtField label={a.toughness} value={toughness} onChange={setToughness} />
            </div>
          )}
          {KEYWORD_GROUPS.flatMap(({ key, keywords }) => [
            <h3 key={key} className="sm:col-span-2 px-1 pt-2 pb-0.5 text-xs uppercase tracking-wide text-dc-muted first:pt-0">{a.groups[key]}</h3>,
            ...keywords.map((k) => {
              const Icon = ICONS[k]
              return (
                <div key={k} className={needsParam(k) || ruleOpen === k ? 'sm:col-span-2' : ''}>
                  <div className="flex items-center rounded hover:bg-dc-border/60">
                    <label className="flex-1 min-w-0 flex items-center gap-2 px-1 py-1.5 text-sm text-dc-text cursor-pointer tablet:py-2.5">
                      <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} />
                      <Icon className="w-4 h-4 text-dc-gold-light shrink-0" aria-hidden="true" />
                      <span>{keywordLabel(k, t)}{note(k) && <span className="text-dc-muted text-xs">{note(k)}</span>}</span>
                    </label>
                    <button type="button" onClick={() => setRuleOpen((r) => (r === k ? null : k))} aria-expanded={ruleOpen === k}
                      aria-label={a.ruleAria(keywordLabel(k, t))} title={a.ruleTitle}
                      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full tablet:w-9 tablet:h-9 ${ruleOpen === k ? 'text-dc-gold' : 'text-dc-muted hover:text-dc-text'}`}>
                      <Info className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  {ruleOpen === k && (
                    <p className="ml-7 mb-1.5 px-2 py-1.5 rounded bg-dc-bg border border-dc-border text-xs leading-snug text-dc-text" data-testid="ability-rule">
                      {abilityRule(k, t, needsParam(k) ? paramOf(k) : undefined)}
                    </p>
                  )}
                  {needsParam(k) && k === 'Protection' && <ProtectionChoice value={params.Protection ?? ''} onChange={setParam(k)} />}
                  {needsParam(k) && k === 'Ward' && <WardChoice value={params.Ward ?? ''} onChange={setParam(k)} />}
                  {needsParam(k) && isNumbered(k) && <NumberChoice keyword={k} value={params[k] ?? ''} onChange={setParam(k)} />}
                </div>
              )
            }),
          ])}
        </div>
        <fieldset className="mx-3 mb-3 px-3 pb-2 border border-dc-border rounded-lg flex flex-wrap gap-x-4 gap-y-1 text-sm text-dc-text">
          <legend className="px-1 text-xs text-dc-muted">{effect ? a.effectDuration : a.addedDuration}</legend>
          <label className="flex items-center gap-1.5 cursor-pointer tablet:py-1.5">
            <input type="radio" name="duree" checked={!untilEndOfTurn} onChange={() => setUntilEndOfTurn(false)} /> {a.always}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer tablet:py-1.5">
            <input type="radio" name="duree" checked={untilEndOfTurn} onChange={() => setUntilEndOfTurn(true)} /> {a.untilEndOfTurn}
          </label>
        </fieldset>
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          {missing && <span className="mr-auto text-xs text-dc-red-light" role="status">{a.missing(missingText)}</span>}
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-dc-border text-sm text-dc-text">{t.common.cancel}</button>
          <button type="submit" disabled={missing || empty} className="px-3 py-1.5 rounded-lg bg-dc-gold text-black text-sm font-semibold disabled:opacity-40">{a.validate}</button>
        </div>
      </form>
    </div>
  )
}
