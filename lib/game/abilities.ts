// Capacités données ou perdues sur la table (« Donner une capacité… ») : liste fermée, état voulu et ligne de journal.

/** Capacités proposées, en mots-clés anglais de Scryfall (comme les capacités imprimées), dans l'ordre de la modale. */
export const KEYWORDS = [
  'Flying', 'Deathtouch', 'Lifelink', 'Trample', 'Vigilance', 'Haste', 'First strike', 'Double strike',
  'Hexproof', 'Shroud', 'Indestructible', 'Menace', 'Reach', 'Defender', 'Infect',
] as const

export type Keyword = (typeof KEYWORDS)[number]

const LABELS: Record<Keyword, string> = {
  Flying: 'Vol', Deathtouch: 'Contact mortel', Lifelink: 'Lien de vie', Trample: 'Piétinement', Vigilance: 'Vigilance',
  Haste: 'Célérité', 'First strike': 'Initiative', 'Double strike': 'Double initiative', Hexproof: 'Défense talismanique',
  Shroud: 'Linceul', Indestructible: 'Indestructible', Menace: 'Menace', Reach: 'Portée', Defender: 'Défenseur', Infect: 'Infection',
}

/** Nom français officiel de la capacité. */
export const keywordLabel = (keyword: Keyword): string => LABELS[keyword]

export const isKeyword = (value: unknown): value is Keyword => (KEYWORDS as readonly unknown[]).includes(value)

/** Capacité donnée à un permanent, pour toujours (tant qu'il reste en jeu) ou jusqu'à la fin du tour. */
export type GainedAbility = { keyword: Keyword; untilEndOfTurn?: true }

/** Capacités d'un permanent : données, et imprimées perdues ; champs absents quand ils sont vides. */
export type Abilities = { gained?: GainedAbility[]; lost?: Keyword[] }

/**
 * Capacités après « Valider » : `gained` et `lost` sont les listes voulues. Une capacité déjà donnée garde sa durée ;
 * une capacité ajoutée prend celle choisie (`untilEndOfTurn`).
 */
export function nextAbilities(card: Abilities, gained: Keyword[], lost: Keyword[], untilEndOfTurn: boolean): Abilities {
  const before = new Map((card.gained ?? []).map((g) => [g.keyword, g]))
  const next = [...new Set(gained)].map((keyword) => before.get(keyword) ?? (untilEndOfTurn ? { keyword, untilEndOfTurn: true as const } : { keyword }))
  const lostNext = [...new Set(lost)]
  return { ...(next.length > 0 ? { gained: next } : {}), ...(lostNext.length > 0 ? { lost: lostNext } : {}) }
}

/** « A », « A et B », « A, B et C ». */
function list(keywords: Keyword[]): string {
  const labels = keywords.map(keywordLabel)
  return labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`
}

/** Ligne de journal d'un changement (« donne Piétinement à Elfes (jusqu’à la fin du tour) ») ; null si rien n'a changé. */
export function abilitiesLog(name: string, before: Abilities, after: Abilities): string | null {
  const had = new Set((before.gained ?? []).map((g) => g.keyword))
  const has = new Set((after.gained ?? []).map((g) => g.keyword))
  const wasLost = new Set(before.lost ?? [])
  const isLost = new Set(after.lost ?? [])
  const added = (after.gained ?? []).filter((g) => !had.has(g.keyword))
  const removed = [...[...had].filter((k) => !has.has(k)), ...[...isLost].filter((k) => !wasLost.has(k))]
  const restored = [...wasLost].filter((k) => !isLost.has(k))
  const parts: string[] = []
  if (added.length > 0) {
    const eot = added.every((g) => g.untilEndOfTurn) ? ' (jusqu’à la fin du tour)' : ''
    parts.push(`donne ${list(added.map((g) => g.keyword))} à ${name}${eot}`)
  }
  if (removed.length > 0) parts.push(`retire ${list(removed)} à ${name}`)
  if (restored.length > 0) parts.push(`rend ${list(restored)} à ${name}`)
  return parts.length > 0 ? parts.join(' ; ') : null
}
