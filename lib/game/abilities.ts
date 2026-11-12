// Capacités données ou perdues sur la table (« Donner une capacité… ») : liste fermée, état voulu et ligne de journal.
// Textes affichés : dictionnaire `t.table.abilities` ; le journal écrit par le moteur reste en français (`fr`).
import type { Messages } from '@/lib/i18n/messages'
import { fr } from '@/lib/i18n/messages/fr'

// Capacités proposées, en mots-clés anglais de Scryfall (comme les capacités imprimées), par groupe, dans l'ordre de la modale.
const COMMON = [
  'Flying', 'Deathtouch', 'Lifelink', 'Trample', 'Vigilance', 'Haste', 'First strike', 'Double strike',
  'Hexproof', 'Shroud', 'Indestructible', 'Menace', 'Reach', 'Defender', 'Infect', 'Protection', 'Ward',
] as const
const EVASION = ['Fear', 'Intimidate', 'Shadow', 'Skulk', 'Plainswalk', 'Islandwalk', 'Swampwalk', 'Mountainwalk', 'Forestwalk'] as const
const OTHERS = ['Prowess', 'Exalted', 'Wither', 'Battle cry', 'Myriad', 'Melee', 'Dethrone', 'Mentor', 'Training', 'Persist', 'Undying'] as const
/** Capacités suivies d'un nombre (« Annihilateur 2 »). */
const NUMBERED = ['Annihilator', 'Toxic', 'Afflict', 'Bushido', 'Afterlife', 'Absorb'] as const

export const KEYWORDS = [...COMMON, ...EVASION, ...OTHERS, ...NUMBERED] as const

/** Groupes de la fenêtre « Capacités » ; leur titre est dans le dictionnaire (`t.table.abilities.groups`). */
export const KEYWORD_GROUPS: { key: 'common' | 'evasion' | 'others' | 'numbered'; keywords: readonly Keyword[] }[] = [
  { key: 'common', keywords: COMMON },
  { key: 'evasion', keywords: EVASION },
  { key: 'others', keywords: OTHERS },
  { key: 'numbered', keywords: NUMBERED },
]

export type Keyword = (typeof KEYWORDS)[number]
/** Capacité chiffrée (« Annihilateur 2 »). */
export type NumberedKeyword = (typeof NUMBERED)[number]
/** Capacité sans précision : son texte des règles est fixe. */
export type PlainKeyword = Exclude<Keyword, 'Protection' | 'Ward' | NumberedKeyword>

/**
 * Texte des règles dans la langue de `t` (repris du texte de rappel des cartes imprimées ; Protection : résumé), avec sa
 * précision quand elle en a une : la valeur à la place de « N » (« sacrifie 2 permanents »), le coût d'une Parade
 * (« paie {2} »), les couleurs d'une Protection (« ce qui est rouge ou vert ») ; sans précision, le texte générique.
 */
export function abilityRule(keyword: Keyword, t: Messages, param?: string): string {
  const a = t.table.abilities
  if (isNumbered(keyword)) return a.numberedRule[keyword as NumberedKeyword](param && isValidParam(keyword, param) ? param : 'N')
  if (keyword === 'Ward') return a.wardRule(param ? param.trim() : null)
  if (keyword === 'Protection') {
    if (!param || !isValidParam(keyword, param)) return a.protectionRule(null)
    return a.protectionRule(param === PROTECTION_ALL ? a.protectionAnything
      : a.protectionWhat(param.split(',').map((c) => a.colorAdjectives[c as Color])))
  }
  return a.rules[keyword as PlainKeyword]
}

/** Nom officiel de la capacité dans la langue de `t` (« Vol » / « Flying »). */
export const keywordLabel = (keyword: Keyword, t: Messages): string => t.table.abilities.labels[keyword]

export const isKeyword = (value: unknown): value is Keyword => (KEYWORDS as readonly unknown[]).includes(value)

/** Capacités qui ont besoin d'une précision : couleurs d'une Protection, coût d'une Parade, nombre (Annihilateur…). */
const PARAM_KEYWORDS: readonly Keyword[] = ['Protection', 'Ward', ...NUMBERED]
/** Capacité suivie d'un nombre. */
export const isNumbered = (keyword: Keyword): boolean => (NUMBERED as readonly Keyword[]).includes(keyword)
export const takesParam = (keyword: Keyword): boolean => PARAM_KEYWORDS.includes(keyword)

/** Couleurs d'une Protection, dans l'ordre WUBRG. */
export const COLORS = ['W', 'U', 'B', 'R', 'G'] as const
export type Color = (typeof COLORS)[number]
/** Protection contre tout. */
export const PROTECTION_ALL = 'all'
const MAX_WARD = 40

/**
 * Paramètre valable pour la capacité : Protection, « all » ou des couleurs WUBRG dans l'ordre séparées par des virgules ;
 * Parade, un coût de 1 à 40 caractères sur une ligne ; Annihilateur et les autres capacités chiffrées, un nombre de 1 à 99 ;
 * les autres capacités n'en prennent pas.
 */
export function isValidParam(keyword: Keyword, param: unknown): boolean {
  if (!takesParam(keyword)) return param === undefined
  if (typeof param !== 'string') return false
  if (keyword === 'Protection') {
    if (param === PROTECTION_ALL) return true
    const order = param.split(',').map((c) => COLORS.indexOf(c as Color))
    return order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1]))
  }
  if (isNumbered(keyword)) return /^[1-9][0-9]?$/.test(param)
  // eslint-disable-next-line no-control-regex
  return param.trim().length > 0 && param.length <= MAX_WARD && !/[\u0000-\u001f]/.test(param)
}

/** Capacité donnée à un permanent, pour toujours (tant qu'il reste en jeu) ou jusqu'à la fin du tour ; `param` : sa précision. */
export type GainedAbility = { keyword: Keyword; untilEndOfTurn?: true; param?: string }

/** Capacité cochée dans la fenêtre : un mot-clé, ou une capacité avec sa précision. */
export type AbilityChoice = Keyword | { keyword: Keyword; param: string }

/** « A », « A et B », « A, B et C » (journal de partie, en français). */
export function join(items: string[]): string {
  return fr.table.abilities.list(items)
}

/** Précision en toutes lettres : « contre le rouge et le vert », « contre tout », « {2} ». */
function paramText(keyword: Keyword, param: string, t: Messages): string {
  const a = t.table.abilities
  if (keyword !== 'Protection') return param
  if (param === PROTECTION_ALL) return a.protectionAll
  return a.protectionFrom(param.split(',').map((c) => a.colors[c as Color] ?? c))
}

/** Capacité en toutes lettres dans la langue de `t` : « Célérité », « Protection contre le rouge », « Parade {2} », « Annihilateur 2 ». */
export function abilityName(ability: { keyword: Keyword; param?: string }, t: Messages): string {
  const label = keywordLabel(ability.keyword, t)
  return ability.param ? `${label} ${paramText(ability.keyword, ability.param, t)}` : label
}

/** Capacité en toutes lettres en français, pour le journal écrit par le moteur. */
export const abilityText = (ability: { keyword: Keyword; param?: string }): string => abilityName(ability, fr)

/** Capacités d'un permanent : données, et imprimées perdues ; champs absents quand ils sont vides. */
export type Abilities = { gained?: GainedAbility[]; lost?: Keyword[] }

/**
 * Capacités après « Valider » : `gained` et `lost` sont les listes voulues. Une capacité déjà donnée garde sa durée ;
 * une capacité ajoutée prend celle choisie (`untilEndOfTurn`).
 */
export function nextAbilities(card: Abilities, gained: AbilityChoice[], lost: Keyword[], untilEndOfTurn: boolean): Abilities {
  const before = new Map((card.gained ?? []).map((g) => [g.keyword, g]))
  const chosen = new Map<Keyword, string | undefined>()
  for (const choice of gained) {
    const [keyword, param] = typeof choice === 'string' ? [choice, undefined] : [choice.keyword, choice.param]
    if (!chosen.has(keyword)) chosen.set(keyword, param)
  }
  const next = [...chosen].map(([keyword, param]): GainedAbility => {
    const eot = before.has(keyword) ? before.get(keyword)!.untilEndOfTurn : untilEndOfTurn || undefined
    return { keyword, ...(param !== undefined ? { param } : {}), ...(eot ? { untilEndOfTurn: true as const } : {}) }
  })
  const lostNext = [...new Set(lost)]
  return { ...(next.length > 0 ? { gained: next } : {}), ...(lostNext.length > 0 ? { lost: lostNext } : {}) }
}

/**
 * Capacités après un effet de groupe : celles choisies s'ajoutent aux capacités données, sauf une capacité imprimée
 * et pas perdue (déjà sur la carte). Une capacité déjà donnée prend la nouvelle précision et devient permanente si
 * l'effet l'est (jamais l'inverse).
 */
export function addAbilities(card: Abilities, printed: string[], choices: AbilityChoice[], untilEndOfTurn: boolean): Abilities {
  const next = [...(card.gained ?? [])]
  for (const choice of choices) {
    const [keyword, param] = typeof choice === 'string' ? [choice, undefined] : [choice.keyword, choice.param]
    const at = next.findIndex((g) => g.keyword === keyword)
    if (at < 0 && printed.includes(keyword) && !card.lost?.includes(keyword)) continue
    const before = at < 0 ? undefined : next[at]
    const eot = untilEndOfTurn && (!before || !!before.untilEndOfTurn)
    const kept = param ?? before?.param
    const ability: GainedAbility = { keyword, ...(kept !== undefined ? { param: kept } : {}), ...(eot ? { untilEndOfTurn: true as const } : {}) }
    if (at < 0) next.push(ability)
    else next[at] = ability
  }
  return { ...(next.length > 0 ? { gained: next } : {}), ...(card.lost?.length ? { lost: card.lost } : {}) }
}

const list = (keywords: Keyword[]): string => join(keywords.map((k) => keywordLabel(k, fr)))

/** Ligne de journal d'un changement (« donne Piétinement à Elfes (jusqu’à la fin du tour) ») ; null si rien n'a changé. */
export function abilitiesLog(name: string, before: Abilities, after: Abilities): string | null {
  const had = new Map((before.gained ?? []).map((g) => [g.keyword, g]))
  const has = new Set((after.gained ?? []).map((g) => g.keyword))
  const wasLost = new Set(before.lost ?? [])
  const isLost = new Set(after.lost ?? [])
  const added = (after.gained ?? []).filter((g) => !had.has(g.keyword))
  const changed = (after.gained ?? []).filter((g) => had.has(g.keyword) && had.get(g.keyword)!.param !== g.param && g.param !== undefined)
  const removed = [...[...had.keys()].filter((k) => !has.has(k)), ...[...isLost].filter((k) => !wasLost.has(k))]
  const restored = [...wasLost].filter((k) => !isLost.has(k))
  const parts: string[] = []
  if (added.length > 0) {
    const eot = added.every((g) => g.untilEndOfTurn) ? ' (jusqu’à la fin du tour)' : ''
    parts.push(`donne ${join(added.map(abilityText))} à ${name}${eot}`)
  }
  for (const g of changed) parts.push(`change ${keywordLabel(g.keyword, fr)} de ${name} : ${paramText(g.keyword, g.param!, fr)}`)
  if (removed.length > 0) parts.push(`retire ${list(removed)} à ${name}`)
  if (restored.length > 0) parts.push(`rend ${list(restored)} à ${name}`)
  return parts.length > 0 ? parts.join(' ; ') : null
}

/** Capacités données et perdues en toutes lettres dans la langue de `t`, pour l'aperçu de la carte ; aucune : liste vide. */
export function abilitiesSummary(card: Abilities, t: Messages): string[] {
  const a = t.table.abilities
  const lines: string[] = []
  if (card.gained?.length) {
    lines.push(a.summaryGained(card.gained.map((g) => `${abilityName(g, t)}${g.untilEndOfTurn ? a.thisTurn : ''}`).join(', ')))
  }
  if (card.lost?.length) lines.push(a.summaryLost(card.lost.map((k) => keywordLabel(k, t)).join(', ')))
  return lines
}
