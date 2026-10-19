// Capacités données ou perdues sur la table (« Donner une capacité… ») : liste fermée, état voulu et ligne de journal.

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

/** Groupes de la fenêtre « Capacités ». */
export const KEYWORD_GROUPS: { title: string; keywords: readonly Keyword[] }[] = [
  { title: 'Courantes', keywords: COMMON },
  { title: 'Évasion', keywords: EVASION },
  { title: 'Combat et retour', keywords: OTHERS },
  { title: 'Avec une valeur', keywords: NUMBERED },
]

export type Keyword = (typeof KEYWORDS)[number]

const LABELS: Record<Keyword, string> = {
  Flying: 'Vol', Deathtouch: 'Contact mortel', Lifelink: 'Lien de vie', Trample: 'Piétinement', Vigilance: 'Vigilance',
  Haste: 'Célérité', 'First strike': 'Initiative', 'Double strike': 'Double initiative', Hexproof: 'Défense talismanique',
  Shroud: 'Linceul', Indestructible: 'Indestructible', Menace: 'Menace', Reach: 'Portée', Defender: 'Défenseur', Infect: 'Infection',
  Protection: 'Protection', Ward: 'Parade',
  Fear: 'Peur', Intimidate: 'Intimidation', Shadow: 'Ombre', Skulk: 'Furtivité', Plainswalk: 'Traversée des plaines',
  Islandwalk: 'Traversée des îles', Swampwalk: 'Traversée des marais', Mountainwalk: 'Traversée des montagnes', Forestwalk: 'Traversée des forêts',
  Prowess: 'Prouesse', Exalted: 'Exaltation', Wither: 'Flétrissure', 'Battle cry': 'Cri de guerre', Myriad: 'Myriade', Melee: 'Mêlée',
  Dethrone: 'Détrônement', Mentor: 'Mentor', Training: 'Entraînement', Persist: 'Persistance', Undying: 'Immortalité',
  Annihilator: 'Annihilateur', Toxic: 'Toxique', Afflict: 'Affliction', Bushido: 'Bushido', Afterlife: 'Après-vie', Absorb: 'Absorption',
}

/** Nom français officiel de la capacité. */
export const keywordLabel = (keyword: Keyword): string => LABELS[keyword]

export const isKeyword = (value: unknown): value is Keyword => (KEYWORDS as readonly unknown[]).includes(value)

/** Capacités qui ont besoin d'une précision : couleurs d'une Protection, coût d'une Parade, nombre (Annihilateur…). */
const PARAM_KEYWORDS: readonly Keyword[] = ['Protection', 'Ward', ...NUMBERED]
/** Capacité suivie d'un nombre. */
export const isNumbered = (keyword: Keyword): boolean => (NUMBERED as readonly Keyword[]).includes(keyword)
export const takesParam = (keyword: Keyword): boolean => PARAM_KEYWORDS.includes(keyword)

/** Couleurs d'une Protection, dans l'ordre WUBRG. */
export const COLORS = ['W', 'U', 'B', 'R', 'G'] as const
export type Color = (typeof COLORS)[number]
const COLOR_NAMES: Record<Color, string> = { W: 'le blanc', U: 'le bleu', B: 'le noir', R: 'le rouge', G: 'le vert' }
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

/** « A », « A et B », « A, B et C ». */
function join(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`
}

/** Précision en toutes lettres : « contre le rouge et le vert », « contre tout », « {2} ». */
function paramText(keyword: Keyword, param: string): string {
  if (keyword !== 'Protection') return param
  if (param === PROTECTION_ALL) return 'contre tout'
  return `contre ${join(param.split(',').map((c) => COLOR_NAMES[c as Color] ?? c))}`
}

/** Capacité en toutes lettres : « Célérité », « Protection contre le rouge », « Parade {2} », « Annihilateur 2 ». */
export function abilityText(ability: { keyword: Keyword; param?: string }): string {
  const label = keywordLabel(ability.keyword)
  return ability.param ? `${label} ${paramText(ability.keyword, ability.param)}` : label
}

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

const list = (keywords: Keyword[]): string => join(keywords.map(keywordLabel))

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
  for (const g of changed) parts.push(`change ${keywordLabel(g.keyword)} de ${name} : ${paramText(g.keyword, g.param!)}`)
  if (removed.length > 0) parts.push(`retire ${list(removed)} à ${name}`)
  if (restored.length > 0) parts.push(`rend ${list(restored)} à ${name}`)
  return parts.length > 0 ? parts.join(' ; ') : null
}

/** Capacités données et perdues en toutes lettres, pour l'aperçu de la carte ; aucune : liste vide. */
export function abilitiesSummary(card: Abilities): string[] {
  const lines: string[] = []
  if (card.gained?.length) {
    lines.push(`Capacités données : ${card.gained.map((g) => `${abilityText(g)}${g.untilEndOfTurn ? ' (ce tour)' : ''}`).join(', ')}`)
  }
  if (card.lost?.length) lines.push(`Capacités perdues : ${card.lost.map(keywordLabel).join(', ')}`)
  return lines
}
