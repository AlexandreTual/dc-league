import type { Lang } from './groups'

/** Clé du choix de langue des cartes (table de jeu et page d'un deck). */
export const LANG_KEY = 'dc-card-lang'

/**
 * Langue des cartes mémorisée ; tant qu'elle n'a jamais été choisie (ou si le stockage est indisponible),
 * `fallback`, la langue de l'interface.
 */
export function readLang(fallback: Lang = 'fr'): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    return saved === 'en' || saved === 'fr' ? saved : fallback
  } catch {
    return fallback
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // stockage indisponible : la préférence ne sera simplement pas mémorisée
  }
}
