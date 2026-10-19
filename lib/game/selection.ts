// Sélection de plusieurs cartes à la table (rectangle tracé sur mon champ de bataille ou ma main).
// Pur : cartes encore sélectionnées, positions d'un groupe déplacé, menu du groupe.
import type { ClientAction } from './room'
import type { MenuCommand, MenuContext, MenuEntry } from './menus'
import type { PlayerView, VisibleCard, ZoneRef } from './types'

/** Cartes sélectionnées, toutes dans la même zone, dans l'ordre de cette zone. */
export type Selection = { zone: ZoneRef; ids: string[] }

/** Seuls mon champ de bataille et ma main permettent une sélection. */
export function canSelectIn(me: string | null, zone: ZoneRef): boolean {
  return me !== null && zone.player === me && (zone.zone === 'battlefield' || zone.zone === 'hand')
}

/** Cartes visibles d'une zone, dans son ordre (bibliothèque exclue). */
function zoneCards(view: PlayerView, zone: ZoneRef): VisibleCard[] {
  if (zone.zone === 'library') return []
  return (view.players[zone.player]?.zones[zone.zone] ?? []).filter((c): c is VisibleCard => !c.hidden)
}

/** La sélection réduite aux cartes encore dans sa zone, dans l'ordre de la zone ; null si plus rien. */
export function liveSelection(view: PlayerView, selection: Selection | null): Selection | null {
  if (!selection) return null
  const ids = zoneCards(view, selection.zone).map((c) => c.id).filter((id) => selection.ids.includes(id))
  return ids.length > 0 ? { zone: selection.zone, ids } : null
}

/** Rectangle tracé : remplace la sélection, ou s'y ajoute (Maj, Ctrl) dans la même zone. */
export function selectIds(selection: Selection | null, zone: ZoneRef, ids: string[], additive: boolean): Selection | null {
  const same = !!selection && selection.zone.player === zone.player && selection.zone.zone === zone.zone
  const next = additive && same ? [...selection.ids, ...ids.filter((id) => !selection.ids.includes(id))] : ids
  return next.length > 0 ? { zone, ids: next } : null
}

/** Maj + clic (ou Ctrl) sur une carte : l'ajoute ou la retire ; une carte d'une autre zone repart d'une sélection neuve. */
export function toggleId(selection: Selection | null, zone: ZoneRef, id: string): Selection | null {
  const same = !!selection && selection.zone.player === zone.player && selection.zone.zone === zone.zone
  if (!same) return { zone, ids: [id] }
  const ids = selection.ids.includes(id) ? selection.ids.filter((x) => x !== id) : [...selection.ids, id]
  return ids.length > 0 ? { zone, ids } : null
}

const clampPct = (n: number) => Math.round(Math.max(0, Math.min(100, n)) * 10) / 10

/** Groupe déplacé sur le champ de bataille : chaque carte suit le même décalage que celle tenue. */
export function shiftedPlaces(cards: { x: number; y: number }[], dx: number, dy: number): { x: number; y: number }[] {
  return cards.map((c) => ({ x: clampPct(c.x + dx), y: clampPct(c.y + dy) }))
}

/** Écart horizontal entre deux cartes posées en rangée (en % de la largeur du champ de bataille). */
export const ROW_STEP = 9

/** Cartes posées en rangée depuis la main : la carte `held` (tenue) au point visé, les autres de part et d'autre. */
export function rowPlaces(count: number, at: { x: number; y: number }, held = Math.floor((count - 1) / 2)): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => ({ x: clampPct(at.x + (i - held) * ROW_STEP), y: clampPct(at.y) }))
}

/** Fenêtre « Ordre des cartes » avant de les poser sur une pile ; `position` : dessus ou dessous de la bibliothèque. */
export type OrderRequest = { ids: string[]; zone: 'library' | 'graveyard'; position?: 'top' | 'bottom' }

/** Cartes posées sur une pile dans un ordre choisi : la fenêtre « Ordre des cartes » s'ouvre d'abord. */
const order = (request: OrderRequest): MenuCommand => ({ kind: 'order', ...request })
const act = (action: ClientAction): MenuCommand => ({ kind: 'action', action })
const item = (label: string, ...commands: MenuCommand[]): MenuEntry => ({ kind: 'item', label, commands })

/** Menu d'un groupe de cartes sélectionnées (clic droit ou appui long sur l'une d'elles). */
export function selectionMenu(ctx: MenuContext, selection: Selection): MenuEntry[] {
  if (ctx.readOnly || !canSelectIn(ctx.me, selection.zone)) return []
  const { ids } = selection
  const cards = zoneCards(ctx.view, selection.zone).filter((c) => ids.includes(c.id))
  const entries: MenuEntry[] = [{ kind: 'title', label: `${ids.length} cartes sélectionnées` }]
  if (selection.zone.zone === 'battlefield') {
    const untapped = cards.filter((c) => !c.tapped)
    const tapped = cards.filter((c) => c.tapped)
    if (untapped.length > 0) entries.push(item('Engager', ...untapped.map((c) => act({ type: 'tap', id: c.id }))))
    if (tapped.length > 0) entries.push(item('Dégager', ...tapped.map((c) => act({ type: 'tap', id: c.id }))))
    entries.push(item('Effet sur la sélection…', { kind: 'effect', ids, title: `${ids.length} cartes sélectionnées` }))
    entries.push({ kind: 'separator' }, item('Main', act({ type: 'moveMany', ids, zone: 'hand' })))
  } else {
    entries.push(item('Champ de bataille', act({ type: 'moveMany', ids, zone: 'battlefield', places: rowPlaces(ids.length, { x: 50, y: 50 }) })))
  }
  entries.push(
    item('Cimetière…', order({ ids, zone: 'graveyard' })),
    item('Exil', act({ type: 'moveMany', ids, zone: 'exile' })),
    item('Dessus de la bibliothèque…', order({ ids, zone: 'library', position: 'top' })),
    item('Dessous de la bibliothèque…', order({ ids, zone: 'library', position: 'bottom' })),
    { kind: 'separator' },
    item('Tout désélectionner', { kind: 'clearSelection' }),
  )
  return entries
}
