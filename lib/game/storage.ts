import type { Catalog, GameAction } from './types'

const VERSION = 1
const keyOf = (deckId: string) => `dc-playtest-${deckId}`

type Saved = { version: number; fingerprint: string; actions: GameAction[] }

/** Sauvegarde locale : silencieuse si le stockage est indisponible (navigation privée, quota). */
export function saveGame(catalog: Catalog, actions: readonly GameAction[]): void {
  try {
    const saved: Saved = { version: VERSION, fingerprint: catalog.fingerprint, actions: [...actions] }
    localStorage.setItem(keyOf(catalog.deckId), JSON.stringify(saved))
  } catch {
    // la partie continue sans sauvegarde
  }
}

/** Renvoie les actions sauvegardées, ou null si absentes, illisibles ou d'une autre version du deck. */
export function loadGame(catalog: Catalog): GameAction[] | null {
  try {
    const raw = localStorage.getItem(keyOf(catalog.deckId))
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Saved>
    if (saved.version !== VERSION || saved.fingerprint !== catalog.fingerprint || !Array.isArray(saved.actions)) return null
    return saved.actions
  } catch {
    return null
  }
}

export function clearGame(deckId: string): void {
  try {
    localStorage.removeItem(keyOf(deckId))
  } catch {
    // rien à effacer
  }
}
