export type Shortcut = 'draw' | 'untapAll' | 'nextTurn' | 'shuffle' | 'mulligan' | 'undo' | 'close'

const LETTERS: Record<string, Shortcut> = { d: 'draw', u: 'untapAll', n: 'nextTurn', s: 'shuffle', m: 'mulligan' }

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  if (!el?.tagName) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable
}

/** Raccourci correspondant à une touche ; aucun pendant la saisie dans un champ, sauf Échap. */
export function shortcutFor(e: { key: string; ctrlKey: boolean; metaKey: boolean; target: EventTarget | null }): Shortcut | null {
  if (e.key === 'Escape') return 'close'
  if (isTypingTarget(e.target)) return null
  const k = e.key.toLowerCase()
  if (e.ctrlKey || e.metaKey) return k === 'z' ? 'undo' : null
  return LETTERS[k] ?? null
}
