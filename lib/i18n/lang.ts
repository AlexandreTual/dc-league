// Langue de l'interface : choix des deux langues, lecture du cookie et de l'en-tête du navigateur.
// Pur (sans Next) pour être testé ; `server.ts` le branche sur la requête.

export type Lang = 'fr' | 'en'
export const LANGS: Lang[] = ['fr', 'en']
/** Cookie de la langue de l'interface, lu par le serveur (spec 2026-10-19-english-interface-design). */
export const UI_LANG_COOKIE = 'dc_lang'
export const UI_LANG_MAX_AGE = 365 * 24 * 3600
export const DEFAULT_LANG: Lang = 'fr'
/** Format des dates et des nombres de chaque langue. */
export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' }

export function isLang(v: unknown): v is Lang {
  return v === 'fr' || v === 'en'
}

/**
 * Langue de l'interface : celle du cookie si elle est valable, sinon la première des deux préférée par le navigateur
 * (`Accept-Language`, poids `q` compris) ; une autre langue seule donne l'anglais, aucun en-tête le français.
 */
export function pickLang(cookie: string | undefined | null, acceptLanguage: string | null | undefined): Lang {
  if (isLang(cookie)) return cookie
  if (!acceptLanguage?.trim()) return DEFAULT_LANG
  const prefs = acceptLanguage.split(',').flatMap((part, index) => {
    const [tag, ...params] = part.trim().split(';')
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    const weight = q ? Number(q.slice(2)) : 1
    return tag ? [{ base: tag.trim().toLowerCase().split('-')[0], weight: Number.isFinite(weight) ? weight : 0, index }] : []
  })
  const ours = prefs.filter((p) => isLang(p.base) && p.weight > 0).sort((a, b) => b.weight - a.weight || a.index - b.index)
  return ours.length > 0 ? (ours[0].base as Lang) : 'en'
}

/** Date au format de la langue (fuseau inchangé). */
export function formatDate(d: Date | string, lang: Lang, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleDateString(LOCALES[lang], opts)
}
