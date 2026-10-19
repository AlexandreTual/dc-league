// Raccourcis clavier de la table : touches par défaut (façon Moxfield), touches choisies par le joueur
// (mémorisées sur l'appareil) et commandes d'une carte survolée, reprises de son menu clic droit.
import type { MenuCommand, MenuEntry } from './menus'
import type { PlayerView, VisibleCard, ZoneRef } from './types'

export type TableShortcut = 'draw' | 'untapAll' | 'nextTurn' | 'shuffle' | 'mulligan' | 'undo' | 'help'
export type CardShortcut =
  | 'tap' | 'flip' | 'faceDown' | 'copy' | 'plusCounter' | 'minusCounter' | 'reveal' | 'oracle' | 'abilities'
  | 'toHand' | 'toBattlefield' | 'toGraveyard' | 'toExile' | 'toCommand' | 'toLibraryTop' | 'toLibraryBottom'
export type Shortcut = TableShortcut | CardShortcut

/** Touche normalisée : « ctrl+x », « shift+l », « t », « + », « space »… ; null : pas de touche. */
export type Bindings = Record<Shortcut, string | null>

export const SHORTCUTS: { id: Shortcut; label: string; group: 'table' | 'card'; key: string | null }[] = [
  { id: 'draw', label: 'Piocher une carte', group: 'table', key: 'd' },
  { id: 'untapAll', label: 'Tout dégager', group: 'table', key: 'u' },
  { id: 'nextTurn', label: 'Tour suivant', group: 'table', key: 'n' },
  { id: 'shuffle', label: 'Mélanger la bibliothèque', group: 'table', key: 's' },
  { id: 'mulligan', label: 'Mulligan', group: 'table', key: 'm' },
  { id: 'undo', label: 'Annuler', group: 'table', key: 'ctrl+z' },
  { id: 'help', label: 'Afficher les raccourcis', group: 'table', key: '?' },
  { id: 'tap', label: 'Engager / dégager', group: 'card', key: 't' },
  { id: 'flip', label: 'Retourner (double face)', group: 'card', key: 'f' },
  { id: 'faceDown', label: 'Face cachée / visible', group: 'card', key: 'shift+f' },
  { id: 'copy', label: 'Créer un jeton copie', group: 'card', key: 'ctrl+x' },
  { id: 'plusCounter', label: 'Ajouter un marqueur +1/+1', group: 'card', key: '+' },
  { id: 'minusCounter', label: 'Retirer un marqueur +1/+1', group: 'card', key: '-' },
  { id: 'reveal', label: 'Révéler à tous (main)', group: 'card', key: 'r' },
  { id: 'oracle', label: 'Oracle et règles', group: 'card', key: 'o' },
  { id: 'abilities', label: 'Donner une capacité…', group: 'card', key: 'a' },
  { id: 'toHand', label: 'Envoyer dans la main', group: 'card', key: 'h' },
  { id: 'toBattlefield', label: 'Mettre sur le champ de bataille', group: 'card', key: 'b' },
  { id: 'toGraveyard', label: 'Envoyer au cimetière', group: 'card', key: 'g' },
  { id: 'toExile', label: 'Exiler', group: 'card', key: 'e' },
  { id: 'toCommand', label: 'Envoyer en zone de commandement', group: 'card', key: 'c' },
  { id: 'toLibraryTop', label: 'Dessus de la bibliothèque', group: 'card', key: 'l' },
  { id: 'toLibraryBottom', label: 'Dessous de la bibliothèque', group: 'card', key: 'shift+l' },
]

export const DEFAULT_BINDINGS = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.key])) as Bindings
const IDS = new Set<string>(SHORTCUTS.map((s) => s.id))
export const isCardShortcut = (id: Shortcut): id is CardShortcut => SHORTCUTS.some((s) => s.id === id && s.group === 'card')
/** Raccourci qui fait quitter sa zone à la carte survolée. */
export const movesCard = (id: Shortcut) => id.startsWith('to')

const MODIFIERS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified']
/** Touches réservées : Échap ferme les fenêtres, Tab et Entrée servent à la navigation. */
const RESERVED = ['escape', 'tab', 'enter']

type KeyEvent = { key: string; ctrlKey: boolean; metaKey: boolean; altKey?: boolean; shiftKey?: boolean; target: EventTarget | null }

/**
 * Touche normalisée d'un appui, null pour une touche de modification seule. Maj n'est noté que pour une lettre ou
 * une touche nommée : « + » ou « ? » demandent Maj sur certains claviers (AZERTY) mais pas sur d'autres.
 */
export function comboOf(e: Omit<KeyEvent, 'target'>): string | null {
  if (!e.key || MODIFIERS.includes(e.key)) return null
  const key = e.key === ' ' ? 'space' : e.key.toLowerCase()
  const shiftMatters = /^[a-z]$/.test(key) || key.length > 1
  return [e.ctrlKey || e.metaKey ? 'ctrl' : '', e.altKey ? 'alt' : '', e.shiftKey && shiftMatters ? 'shift' : '', key].filter(Boolean).join('+')
}

/** Touche lisible : « Ctrl+X », « Maj+L », « Espace ». */
export function keyLabel(combo: string): string {
  const names: Record<string, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj', space: 'Espace', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', delete: 'Suppr', backspace: 'Retour arrière' }
  return combo.split(/\+(?=.)/).map((part) => names[part] ?? (part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))).join('+')
}

export const isReserved = (combo: string) => RESERVED.includes(combo)

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  if (!el?.tagName) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable
}

/** Raccourci correspondant à une touche ; aucun pendant la saisie dans un champ, sauf Échap. */
export function shortcutFor(e: KeyEvent, bindings: Bindings = DEFAULT_BINDINGS): Shortcut | 'close' | null {
  if (e.key === 'Escape') return 'close'
  if (isTypingTarget(e.target)) return null
  const combo = comboOf(e)
  if (!combo) return null
  return SHORTCUTS.find((s) => bindings[s.id] === combo)?.id ?? null
}

/** Donne une touche à un raccourci ; le raccourci qui l'avait la perd (`replaced`). */
export function bind(bindings: Bindings, id: Shortcut, combo: string | null): { bindings: Bindings; replaced: Shortcut | null } {
  const replaced = combo === null ? null : SHORTCUTS.find((s) => s.id !== id && bindings[s.id] === combo)?.id ?? null
  const next = { ...bindings, [id]: combo }
  if (replaced) next[replaced] = null
  return { bindings: next, replaced }
}

const KEY = 'dc-shortcuts'

/** Touches enregistrées (seulement celles changées), par-dessus les touches par défaut ; illisibles : ignorées. */
export function parseBindings(raw: string | null): Bindings {
  const bindings = { ...DEFAULT_BINDINGS }
  try {
    const data = JSON.parse(raw ?? '')
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return bindings
    for (const [id, combo] of Object.entries(data)) {
      if (!IDS.has(id) || !(combo === null || (typeof combo === 'string' && combo !== '' && !isReserved(combo)))) continue
      // Une touche donnée deux fois (sauvegarde abîmée) : le dernier raccourci la garde.
      Object.assign(bindings, bind(bindings, id as Shortcut, combo as string | null).bindings)
    }
  } catch {
    // rien d'enregistré ou illisible : les touches par défaut
  }
  return bindings
}

export function loadBindings(): Bindings {
  try {
    return parseBindings(localStorage.getItem(KEY))
  } catch {
    return { ...DEFAULT_BINDINGS }
  }
}

export function saveBindings(bindings: Bindings): void {
  const changed = Object.fromEntries(SHORTCUTS.filter((s) => bindings[s.id] !== s.key).map((s) => [s.id, bindings[s.id]]))
  try {
    localStorage.setItem(KEY, JSON.stringify(changed))
  } catch {
    // touches non mémorisées (navigation privée…)
  }
}

/** Zone où se trouve une carte visible (bibliothèque comprise, pour une carte regardée). */
export function zoneOf(view: PlayerView, id: string): ZoneRef | null {
  for (const [player, p] of Object.entries(view.players)) {
    const { library, ...zones } = p.zones
    for (const [zone, cards] of Object.entries(zones)) if (cards.some((c) => !c.hidden && c.id === id)) return { player, zone: zone as ZoneRef['zone'] }
    if (library.visible.some((v) => v.card.id === id)) return { player, zone: 'library' }
  }
  return null
}

/**
 * Commandes d'un raccourci de carte, prises dans le menu clic droit de cette carte (`cardMenu`) : mêmes droits,
 * mêmes destinations (chez son propriétaire hors du champ de bataille). null : rien à faire pour cette carte.
 */
export function cardShortcutCommands(entries: MenuEntry[], card: VisibleCard, zone: ZoneRef, id: CardShortcut): MenuCommand[] | null {
  const items = entries.flatMap((e) => (e.kind === 'item' ? [e.commands] : []))
  const first = (test: (c: MenuCommand) => boolean) => items.find((commands) => commands.length > 0 && commands.every(test)) ?? null
  const action = (test: (a: Extract<MenuCommand, { kind: 'action' }>['action']) => boolean) => first((c) => c.kind === 'action' && test(c.action))
  const moveTo = (to: ZoneRef['zone'], position?: 'top' | 'bottom') => action((a) => a.type === 'move' && a.to.zone === to && a.position === position)
  const counter = (sign: 'plus' | 'minus') => {
    const stepper = entries.find((e) => e.kind === 'stepper' && e.label === '+1/+1')
    if (stepper?.kind !== 'stepper' || (sign === 'minus' && card.counters.plus === 0)) return null
    return [sign === 'plus' ? stepper.plus : stepper.minus]
  }
  switch (id) {
    case 'tap': return action((a) => a.type === 'tap')
    case 'flip': return action((a) => a.type === 'flip')
    case 'faceDown': return action((a) => a.type === 'faceDown')
    case 'copy': return action((a) => a.type === 'createToken' && a.copy === true)
    case 'plusCounter': return counter('plus')
    case 'minusCounter': return counter('minus')
    case 'reveal': return action((a) => a.type === 'reveal' && a.to === 'all')
    case 'oracle': return first((c) => c.kind === 'oracle')
    case 'abilities': return first((c) => c.kind === 'abilities')
    case 'toHand': return moveTo('hand')
    // Déjà en jeu (le sien ou chez un adversaire) : rien, plutôt que prendre le contrôle par mégarde.
    case 'toBattlefield': return zone.zone === 'battlefield' ? null : moveTo('battlefield')
    case 'toGraveyard': return moveTo('graveyard')
    case 'toExile': return moveTo('exile')
    case 'toCommand': return moveTo('command')
    case 'toLibraryTop': return moveTo('library', 'top')
    case 'toLibraryBottom': return moveTo('library', 'bottom')
  }
}

/** Raccourcis de la table reconnus dans un menu (bibliothèque) : une seule action, la même que la touche. */
const TABLE_ACTIONS: [TableShortcut, (a: Extract<MenuCommand, { kind: 'action' }>['action']) => boolean][] = [
  ['draw', (a) => a.type === 'draw' && a.count === 1],
  ['shuffle', (a) => a.type === 'shuffle'],
  ['untapAll', (a) => a.type === 'untapAll'],
  ['nextTurn', (a) => a.type === 'endTurn'],
  ['mulligan', (a) => a.type === 'mulligan'],
]

/**
 * Touche à afficher en grisé à droite de chaque entrée d'un menu (null : aucune), comme dans Moxfield.
 * `target` : la carte du menu, pour les raccourcis de carte ; l'entrée est celle que la touche déclencherait.
 */
export function menuHints(entries: MenuEntry[], bindings: Bindings, target?: { card: VisibleCard; zone: ZoneRef }): (string | null)[] {
  const hints: (string | null)[] = entries.map(() => null)
  const label = (id: Shortcut) => (bindings[id] ? keyLabel(bindings[id]!) : null)
  entries.forEach((e, i) => {
    if (e.kind !== 'item' || e.commands.length !== 1) return
    const c = e.commands[0]
    const found = c.kind === 'action' ? TABLE_ACTIONS.find(([, test]) => test(c.action)) : undefined
    if (found) hints[i] = label(found[0])
  })
  if (!target) return hints
  for (const s of SHORTCUTS) {
    if (s.group !== 'card' || !bindings[s.id] || s.id === 'plusCounter' || s.id === 'minusCounter') continue
    const commands = cardShortcutCommands(entries, target.card, target.zone, s.id as CardShortcut)
    const i = commands ? entries.findIndex((e) => e.kind === 'item' && e.commands === commands) : -1
    if (i >= 0) hints[i] = label(s.id)
  }
  // Marqueurs +1/+1 : les deux touches sur la ligne du compteur.
  const counter = entries.findIndex((e) => e.kind === 'stepper' && e.label === '+1/+1')
  const keys = [label('minusCounter'), label('plusCounter')].filter(Boolean)
  if (counter >= 0 && keys.length > 0) hints[counter] = keys.join(' ')
  return hints
}
