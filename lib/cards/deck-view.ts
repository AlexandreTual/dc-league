/** Affichage des cartes sur la page d'un deck : visuels (par défaut) ou liste. */
export type DeckViewMode = 'images' | 'list'

/** Clé du choix d'affichage, mémorisé dans le navigateur. */
export const DECK_VIEW_KEY = 'dc-deck-view'

/** Affichage mémorisé ; visuels par défaut et si le stockage est indisponible. */
export function readDeckView(): DeckViewMode {
  try {
    return localStorage.getItem(DECK_VIEW_KEY) === 'list' ? 'list' : 'images'
  } catch {
    return 'images'
  }
}

export function saveDeckView(mode: DeckViewMode) {
  try {
    localStorage.setItem(DECK_VIEW_KEY, mode)
  } catch {
    // stockage indisponible : le choix ne sera simplement pas mémorisé
  }
}
