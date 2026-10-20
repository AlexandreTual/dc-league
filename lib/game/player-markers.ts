// Marqueurs d'un joueur, en liste (bulle « ⋯ » du portrait) : poison, blessures de commandant,
// marqueurs prédéfinis (toujours listés, même à 0) puis marqueurs libres.
import { foldText } from '@/lib/text'
import type { Messages } from '@/lib/i18n/messages'
import { COMMANDER_DAMAGE_LETHAL, POISON_LETHAL, type PlayerView } from './types'

/** Noms enregistrés dans la partie (communs à tous les joueurs, quelle que soit leur langue) ; affichés avec `markerLabel`. */
export const PRESET_MARKERS = ['Énergie', 'Expérience', 'Rad', 'Tickets'] as const
/** Longueur maximale d'un nom de marqueur (validée aussi par le serveur). */
export const MARKER_NAME_MAX = 40

export type MarkerRow =
  | { kind: 'poison'; key: 'poison'; value: number; alert: boolean }
  | { kind: 'commander'; key: string; commander: string; owner: string; value: number; alert: boolean }
  | { kind: 'counter'; key: string; name: string; value: number; preset: boolean }

type Markers = Pick<PlayerView['players'][string], 'poison' | 'counters' | 'commanderDamage'>

/** Comparaison des noms sans casse ni accents (« energie » = « Énergie »). */
const norm = (name: string) => foldText(name.trim())
export const sameMarker = (a: string, b: string) => norm(a) === norm(b)

/** Nom affiché d'un marqueur : un prédéfini (nom enregistré exact) dans la langue de `t`, un marqueur libre tel quel. */
export function markerLabel(name: string, t: Messages): string {
  const i = (PRESET_MARKERS as readonly string[]).indexOf(name)
  return i >= 0 ? t.table.markers.presets[i] : name
}

/**
 * Lignes de la liste : poison, une ligne par commandant adverse connu, les prédéfinis puis les libres.
 * Un marqueur libre de même nom qu'un prédéfini (à la casse et aux accents près) prend sa place.
 */
export function markerRows(p: Markers, commanders: { id: string; owner: string }[]): MarkerRow[] {
  const rows: MarkerRow[] = [{ kind: 'poison', key: 'poison', value: p.poison, alert: p.poison >= POISON_LETHAL }]
  for (const c of commanders) {
    const value = p.commanderDamage[c.id] ?? 0
    rows.push({ kind: 'commander', key: `commander:${c.id}`, commander: c.id, owner: c.owner, value, alert: value >= COMMANDER_DAMAGE_LETHAL })
  }
  const free = Object.entries(p.counters)
  const used = new Set<string>()
  for (const preset of PRESET_MARKERS) {
    const [name, value] = free.find(([n]) => sameMarker(n, preset)) ?? [preset, 0]
    used.add(name)
    rows.push({ kind: 'counter', key: `counter:${name}`, name, value, preset: true })
  }
  for (const [name, value] of free) {
    if (!used.has(name)) rows.push({ kind: 'counter', key: `counter:${name}`, name, value, preset: false })
  }
  return rows
}

/**
 * Création d'un marqueur à la volée : null si le nom convient, '' si vide (rien à faire, sans message),
 * sinon le message à afficher.
 */
export function newMarkerError(p: Markers, raw: string, t: Messages): string | null {
  const m = t.table.markers
  const name = raw.trim()
  if (!name) return ''
  if (name.length > MARKER_NAME_MAX) return m.tooLong(MARKER_NAME_MAX)
  // Noms déjà pris, avec leur nom affiché : poison, prédéfinis (aussi sous leur nom traduit), marqueurs libres.
  const taken: [string, string][] = [
    ['Poison', m.poison], [m.poison, m.poison],
    ...PRESET_MARKERS.flatMap((n): [string, string][] => [[n, markerLabel(n, t)], [markerLabel(n, t), markerLabel(n, t)]]),
    ...Object.keys(p.counters).map((n): [string, string] => [n, markerLabel(n, t)]),
  ]
  const existing = taken.find(([n]) => sameMarker(n, name))
  return existing ? m.exists(existing[1]) : null
}
