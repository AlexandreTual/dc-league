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
  Fear: 'Peur', Intimidate: 'Intimidation', Shadow: 'Distorsion', Skulk: 'Furtivité', Plainswalk: 'Traversée des plaines',
  Islandwalk: 'Traversée des îles', Swampwalk: 'Traversée des marais', Mountainwalk: 'Traversée des montagnes', Forestwalk: 'Traversée des forêts',
  Prowess: 'Prouesse', Exalted: 'Exaltation', Wither: 'Flétrissure', 'Battle cry': 'Cri de guerre', Myriad: 'Myriade', Melee: 'Mêlée',
  Dethrone: 'Détrônement', Mentor: 'Mentor', Training: 'Entraînement', Persist: 'Persistance', Undying: 'Survivance',
  Annihilator: 'Annihilateur', Toxic: 'Toxique', Afflict: 'Affliction', Bushido: 'Bushido', Afterlife: 'Après-vie', Absorb: 'Absorption',
}

/**
 * Texte des règles en français, repris du texte de rappel des cartes imprimées (Protection : résumé). « N » : la valeur
 * d'une capacité chiffrée ; « le coût » : celui d'une Parade.
 */
const RULES: Record<Keyword, string> = {
  Flying: 'Cette créature ne peut pas être bloquée excepté par des créatures avec le vol et/ou la portée.',
  Deathtouch: 'Toute quantité de blessures que cette créature inflige à une créature suffit à la détruire.',
  Lifelink: 'Les blessures infligées par cette créature vous font aussi gagner autant de points de vie.',
  Trample: 'Cette créature peut infliger les blessures de combat en excès au joueur ou au planeswalker qu’elle attaque.',
  Vigilance: 'Attaquer ne fait pas engager cette créature.',
  Haste: 'Cette créature peut attaquer et utiliser ses capacités {T} dès qu’elle arrive sous votre contrôle.',
  'First strike': 'Cette créature inflige ses blessures de combat avant les créatures sans l’initiative.',
  'Double strike': 'Cette créature inflige des blessures d’initiative et des blessures de combat normales.',
  Hexproof: 'Ce permanent ne peut pas être la cible de sorts ou de capacités que vos adversaires contrôlent.',
  Shroud: 'Ce permanent ne peut pas être la cible de sorts ou de capacités.',
  Indestructible: 'Les blessures et les effets qui disent « détruisez » ne détruisent pas ce permanent.',
  Menace: 'Cette créature ne peut pas être bloquée excepté par deux créatures ou plus.',
  Reach: 'Cette créature peut bloquer les créatures avec le vol.',
  Defender: 'Cette créature ne peut pas attaquer.',
  Infect: 'Cette créature inflige des blessures aux créatures sous forme de marqueurs -1/-1 et aux joueurs sous forme de marqueurs « poison ».',
  Protection: 'Ce permanent ne peut pas être bloqué, ciblé, enchanté ni équipé par ce qui a la qualité choisie, et toutes les blessures qui en viennent sont prévenues.',
  Ward: 'À chaque fois que ce permanent devient la cible d’un sort ou d’une capacité qu’un adversaire contrôle, contrecarrez-le à moins que ce joueur ne paie le coût.',
  Fear: 'Cette créature ne peut pas être bloquée excepté par des créatures-artefacts et/ou des créatures noires.',
  Intimidate: 'Cette créature ne peut pas être bloquée excepté par des créatures-artefacts et/ou des créatures qui partagent une couleur avec elle.',
  Shadow: 'Cette créature ne peut bloquer ou être bloquée que par des créatures avec la distorsion.',
  Skulk: 'Cette créature ne peut pas être bloquée par des créatures de force supérieure.',
  Plainswalk: 'Cette créature ne peut pas être bloquée tant que le joueur défenseur contrôle au moins une plaine.',
  Islandwalk: 'Cette créature ne peut pas être bloquée tant que le joueur défenseur contrôle au moins une île.',
  Swampwalk: 'Cette créature ne peut pas être bloquée tant que le joueur défenseur contrôle au moins un marais.',
  Mountainwalk: 'Cette créature ne peut pas être bloquée tant que le joueur défenseur contrôle au moins une montagne.',
  Forestwalk: 'Cette créature ne peut pas être bloquée tant que le joueur défenseur contrôle au moins une forêt.',
  Prowess: 'À chaque fois que vous lancez un sort non-créature, cette créature gagne +1/+1 jusqu’à la fin du tour.',
  Exalted: 'À chaque fois qu’une créature que vous contrôlez attaque seule, elle gagne +1/+1 jusqu’à la fin du tour.',
  Wither: 'Cette créature inflige des blessures aux créatures sous forme de marqueurs -1/-1.',
  'Battle cry': 'À chaque fois que cette créature attaque, chaque autre créature attaquante gagne +1/+0 jusqu’à la fin du tour.',
  Myriad: 'À chaque fois que cette créature attaque, pour chaque adversaire autre que le joueur défenseur, vous pouvez créer un jeton copie de cette créature, engagé et attaquant ce joueur ou un planeswalker qu’il contrôle. Exilez les jetons à la fin du combat.',
  Melee: 'À chaque fois que cette créature attaque, elle gagne +1/+1 jusqu’à la fin du tour pour chaque adversaire que vous avez attaqué pendant ce combat.',
  Dethrone: 'À chaque fois que cette créature attaque le joueur qui a le total de points de vie le plus élevé ou qui partage le total le plus élevé, mettez un marqueur +1/+1 sur elle.',
  Mentor: 'À chaque fois que cette créature attaque, mettez un marqueur +1/+1 sur une créature attaquante ciblée de force inférieure.',
  Training: 'À chaque fois que cette créature attaque avec une autre créature de force supérieure, mettez un marqueur +1/+1 sur cette créature.',
  Persist: 'Quand cette créature meurt, si elle n’avait pas de marqueur -1/-1 sur elle, renvoyez-la sur le champ de bataille sous le contrôle de son propriétaire avec un marqueur -1/-1 sur elle.',
  Undying: 'Quand cette créature meurt, si elle n’avait pas de marqueur +1/+1 sur elle, renvoyez-la sur le champ de bataille sous le contrôle de son propriétaire avec un marqueur +1/+1 sur elle.',
  Annihilator: 'À chaque fois que cette créature attaque, le joueur défenseur sacrifie N permanents.',
  Toxic: 'Les joueurs qui subissent des blessures de combat de cette créature gagnent aussi N marqueurs « poison ».',
  Afflict: 'À chaque fois que cette créature devient bloquée, le joueur défenseur perd N points de vie.',
  Bushido: 'À chaque fois que cette créature bloque ou devient bloquée, elle gagne +N/+N jusqu’à la fin du tour.',
  Afterlife: 'Quand cette créature meurt, créez N jetons de créature 1/1 blanche et noire Esprit avec le vol.',
  Absorb: 'Si une source devait infliger des blessures à cette créature, prévenez N de ces blessures.',
}

/**
 * Texte des règles de la capacité, avec sa précision quand elle en a une : la valeur à la place de « N » (« sacrifie 2
 * permanents »), le coût d'une Parade (« paie {2} »), les couleurs d'une Protection (« ce qui est rouge ou vert ») ;
 * sans précision, le texte générique.
 */
export function abilityRule(keyword: Keyword, param?: string): string {
  const rule = RULES[keyword]
  if (!param) return rule
  if (isNumbered(keyword) && isValidParam(keyword, param)) {
    // Un seul : « 1 permanent », « 1 marqueur », « 1 jeton … Esprit » ; « +1/+1 » est déjà juste.
    const one = param === '1'
    return rule.replace(/\+N\/\+N/, `+${param}/+${param}`)
      .replace(/\bN (\p{L}+)/u, (_, word: string) => `${param} ${one ? singular(word) : word}`)
  }
  if (keyword === 'Ward') return rule.replace('le coût', param.trim())
  if (keyword === 'Protection' && isValidParam(keyword, param)) {
    const what = param === PROTECTION_ALL ? 'quoi que ce soit'
      : `ce qui est ${param.split(',').map((c) => COLOR_NAMES[c as Color].slice(3)).join(' ou ')}`
    return rule.replace('ce qui a la qualité choisie', what)
  }
  return rule
}

/** « permanents » → « permanent », « points » → « point », « jetons » → « jeton », « marqueurs » → « marqueur ». */
const singular = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word)

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
