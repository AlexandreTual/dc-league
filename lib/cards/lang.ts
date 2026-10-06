import type { Lang } from './groups'

/** Clé du choix de langue des cartes (table de jeu et page d'un deck). */
export const LANG_KEY = 'dc-card-lang'

/** Langue mémorisée ; « fr » par défaut et si le stockage est indisponible. */
export function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // stockage indisponible : la préférence ne sera simplement pas mémorisée
  }
}
