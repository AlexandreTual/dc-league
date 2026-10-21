import { useSyncExternalStore } from 'react'

/**
 * Carte sous la souris, hors de l'état de la table : la survoler ne redessine que ses lecteurs
 * (l'aperçu ; le gestionnaire clavier la lit au moment de l'appui), pas toutes les cartes de la table.
 */
export type HoverStore = {
  get(): string | null
  set(id: string | null): void
  subscribe(listener: () => void): () => void
}

export function createHoverStore(): HoverStore {
  let current: string | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set(id) {
      if (id === current) return
      current = id
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Carte survolée, relue à chaque changement. */
export function useHovered(store: HoverStore): string | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
